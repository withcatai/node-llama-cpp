#include <stddef.h>
#include <algorithm>
#include <sstream>
#include <vector>

#include "llama.h"
#include "common/grammar-parser.h"
#include "napi.h"

class LLAMAModel : public Napi::ObjectWrap<LLAMAModel> {
  public:
    llama_context_params params;
    llama_model* model;
    float temperature;
    int32_t top_k;
    float top_p;

    LLAMAModel(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAModel>(info) {
        params = llama_context_default_params();
        params.seed = -1;
        params.n_ctx = 4096;
        temperature = 0.0f;
        top_k = 40;
        top_p = 0.95f;

        // Get the model path
        std::string modelPath = info[0].As<Napi::String>().Utf8Value();

        if (info.Length() > 1 && info[1].IsObject()) {
            Napi::Object options = info[1].As<Napi::Object>();

            if (options.Has("seed")) {
                params.seed = options.Get("seed").As<Napi::Number>().Int32Value();
            }

            if (options.Has("contextSize")) {
                params.n_ctx = options.Get("contextSize").As<Napi::Number>().Int32Value();
            }

            if (options.Has("batchSize")) {
                params.n_batch = options.Get("batchSize").As<Napi::Number>().Int32Value();
            }

            if (options.Has("gpuLayers")) {
                params.n_gpu_layers = options.Get("gpuLayers").As<Napi::Number>().Int32Value();
            }

            if (options.Has("lowVram")) {
                params.low_vram = options.Get("lowVram").As<Napi::Boolean>().Value();
            }

            if (options.Has("f16Kv")) {
                params.f16_kv = options.Get("f16Kv").As<Napi::Boolean>().Value();
            }

            if (options.Has("logitsAll")) {
                params.logits_all = options.Get("logitsAll").As<Napi::Boolean>().Value();
            }

            if (options.Has("vocabOnly")) {
                params.vocab_only = options.Get("vocabOnly").As<Napi::Boolean>().Value();
            }

            if (options.Has("useMmap")) {
                params.use_mmap = options.Get("useMmap").As<Napi::Boolean>().Value();
            }

            if (options.Has("useMlock")) {
                params.use_mlock = options.Get("useMlock").As<Napi::Boolean>().Value();
            }

            if (options.Has("embedding")) {
                params.embedding = options.Get("embedding").As<Napi::Boolean>().Value();
            }

            if (options.Has("temperature")) {
                temperature = options.Get("temperature").As<Napi::Number>().FloatValue();
            }

            if (options.Has("topK")) {
                top_k = options.Get("topK").As<Napi::Number>().Int32Value();
            }

            if (options.Has("topP")) {
                top_p = options.Get("topP").As<Napi::Number>().FloatValue();
            }
        }

        llama_backend_init(false);
        model = llama_load_model_from_file(modelPath.c_str(), params);

        if (model == NULL) {
            Napi::Error::New(info.Env(), "Failed to load model").ThrowAsJavaScriptException();
            return;
        }
    }

    ~LLAMAModel() {
        llama_free_model(model);
    }

    static void init(Napi::Object exports) {
        exports.Set("LLAMAModel", DefineClass(exports.Env(), "LLAMAModel", {}));
    }
};

class LLAMAGrammar : public Napi::ObjectWrap<LLAMAGrammar> {
  public:
    grammar_parser::parse_state parsed_grammar;
    llama_grammar *grammar = nullptr;

    LLAMAGrammar(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAGrammar>(info) {
        // Get the model path
        std::string grammarCode = info[0].As<Napi::String>().Utf8Value();
        bool should_print_grammar = false;

        if (info.Length() > 1 && info[1].IsObject()) {
            Napi::Object options = info[1].As<Napi::Object>();

            if (options.Has("printGrammar")) {
                should_print_grammar = options.Get("printGrammar").As<Napi::Boolean>().Value();
            }
        }

        parsed_grammar = grammar_parser::parse(grammarCode.c_str());
        // will be empty (default) if there are parse errors
        if (parsed_grammar.rules.empty()) {
            Napi::Error::New(info.Env(), "Failed to parse grammar").ThrowAsJavaScriptException();
            return;
        }

        if (should_print_grammar) {
            grammar_parser::print_grammar(stderr, parsed_grammar);
        }

        std::vector<const llama_grammar_element *> grammar_rules(parsed_grammar.c_rules());
        grammar = llama_grammar_init(
            grammar_rules.data(), grammar_rules.size(), parsed_grammar.symbol_ids.at("root"));
    }

    ~LLAMAGrammar() {
        if (grammar != nullptr) {
            llama_grammar_free(grammar);
            grammar = nullptr;
        }
    }

    static void init(Napi::Object exports) {
        exports.Set("LLAMAGrammar", DefineClass(exports.Env(), "LLAMAGrammar", {}));
    }
};

class LLAMAContext : public Napi::ObjectWrap<LLAMAContext> {
  public:
  LLAMAModel* model;
  llama_context* ctx;
  LLAMAGrammar* grammar;
  bool use_grammar = false;

  LLAMAContext(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAContext>(info) {
    model = Napi::ObjectWrap<LLAMAModel>::Unwrap(info[0].As<Napi::Object>());
    model->Ref();
    ctx = llama_new_context_with_model(model->model, model->params);
    Napi::MemoryManagement::AdjustExternalMemory(Env(), llama_get_state_size(ctx));

    if (info.Length() > 1 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();

        if (options.Has("grammar")) {
            grammar = Napi::ObjectWrap<LLAMAGrammar>::Unwrap(options.Get("grammar").As<Napi::Object>());
            grammar->Ref();
            use_grammar = true;
        }
    }
  }
  ~LLAMAContext() {
    Napi::MemoryManagement::AdjustExternalMemory(Env(), -(int64_t)llama_get_state_size(ctx));
    llama_free(ctx);
    model->Unref();

    if (use_grammar) {
        grammar->Unref();
        use_grammar = false;
    }
  }
  Napi::Value Encode(const Napi::CallbackInfo& info) {
    std::string text = info[0].As<Napi::String>().Utf8Value();

    std::vector<llama_token> tokens(text.size());
    int n = llama_tokenize(ctx, text.data(), tokens.data(), text.size(), false);

    if (n < 0) {
      Napi::Error::New(info.Env(), "String expected").ThrowAsJavaScriptException();
      return info.Env().Undefined();
    }
    tokens.resize(n);

    Napi::Uint32Array result = Napi::Uint32Array::New(info.Env(), n);
    for (size_t i = 0; i < tokens.size(); ++i) { result[i] = static_cast<uint32_t>(tokens[i]); }

    return result;
  }
  Napi::Value Decode(const Napi::CallbackInfo& info) {
    Napi::Uint32Array tokens = info[0].As<Napi::Uint32Array>();

    // Create a stringstream for accumulating the decoded string.
    std::stringstream ss;

    // Decode each token and accumulate the result.
    for (size_t i = 0; i < tokens.ElementLength(); i++) {
      // source: https://github.com/ggerganov/llama.cpp/blob/232caf3c1581a6cb023571780ff41dc2d66d1ca0/llama.cpp#L799-L811
      std::vector<char> result(8, 0);
      const int n_tokens = llama_token_to_str(ctx, (llama_token)tokens[i], result.data(), result.size());
      if (n_tokens < 0) {
          result.resize(-n_tokens);
          int check = llama_token_to_str(ctx, (llama_token)tokens[i], result.data(), result.size());
          GGML_ASSERT(check == -n_tokens);
      } else {
          result.resize(n_tokens);
      }

      const char* str = result.data();
      if (str == nullptr) {
        Napi::Error::New(info.Env(), "Invalid token").ThrowAsJavaScriptException();
        return info.Env().Undefined();
      }
      ss << str;
    }

    return Napi::String::New(info.Env(), ss.str());
  }
  Napi::Value TokenBos(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_token_bos(ctx));
  }
  Napi::Value TokenEos(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_token_eos(ctx));
  }
  Napi::Value GetContextSize(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_n_ctx(ctx));
  }
  Napi::Value GetTokenString(const Napi::CallbackInfo& info) {
    int token = info[0].As<Napi::Number>().Int32Value();
    std::stringstream ss;

    const char* str = llama_token_get_text(ctx, token);
    if (str == nullptr) {
      return info.Env().Undefined();
    }

    ss << str;

    return Napi::String::New(info.Env(), ss.str());
  }
  Napi::Value Eval(const Napi::CallbackInfo& info);
  static void init(Napi::Object exports) {
    exports.Set("LLAMAContext",
        DefineClass(exports.Env(),
            "LLAMAContext",
            {
                InstanceMethod("encode", &LLAMAContext::Encode),
                InstanceMethod("decode", &LLAMAContext::Decode),
                InstanceMethod("tokenBos", &LLAMAContext::TokenBos),
                InstanceMethod("tokenEos", &LLAMAContext::TokenEos),
                InstanceMethod("getContextSize", &LLAMAContext::GetContextSize),
                InstanceMethod("getTokenString", &LLAMAContext::GetTokenString),
                InstanceMethod("eval", &LLAMAContext::Eval),
            }));
  }
};


class LLAMAContextEvalWorker : Napi::AsyncWorker, Napi::Promise::Deferred {
  LLAMAContext* ctx;
  std::vector<llama_token> tokens;
  llama_token result;

  public:
  LLAMAContextEvalWorker(const Napi::CallbackInfo& info, LLAMAContext* ctx) : Napi::AsyncWorker(info.Env(), "LLAMAContextEvalWorker"), ctx(ctx), Napi::Promise::Deferred(info.Env()) {
    ctx->Ref();
    Napi::Uint32Array tokens = info[0].As<Napi::Uint32Array>();
    this->tokens.reserve(tokens.ElementLength());
    for (size_t i = 0; i < tokens.ElementLength(); i++) { this->tokens.push_back(static_cast<llama_token>(tokens[i])); }
  }
  ~LLAMAContextEvalWorker() { ctx->Unref(); }
  using Napi::AsyncWorker::Queue;
  using Napi::Promise::Deferred::Promise;

  protected:
  void Execute() {
    // Perform the evaluation using llama_eval.
    int r = llama_eval(ctx->ctx, tokens.data(), int(tokens.size()), llama_get_kv_cache_token_count(ctx->ctx), 6);
    if (r != 0) {
      SetError("Eval has failed");
      return;
    }

    llama_token new_token_id = 0;

    // Select the best prediction.
    auto logits = llama_get_logits(ctx->ctx);
    auto n_vocab = llama_n_vocab(ctx->ctx);

    std::vector<llama_token_data> candidates;
    candidates.reserve(n_vocab);

    for (llama_token token_id = 0; token_id < n_vocab; token_id++) {
      candidates.emplace_back(llama_token_data{ token_id, logits[token_id], 0.0f });
    }

    llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

    float originalEosLogit = 0;
    auto eos_token = llama_token_eos(ctx->ctx);

    for (auto& candidate : candidates) {
      if (candidate.id == eos_token) {
        originalEosLogit = candidate.logit;
        break;
      }
    }

    if (ctx->use_grammar) {
        llama_sample_grammar(ctx->ctx, &candidates_p, (ctx->grammar)->grammar);
    }

    for (auto& candidate : candidates) {
      if (candidate.id == eos_token) {
        candidate.logit = originalEosLogit;
        break;
      }
    }

    if ((ctx->model)->temperature <= 0) {
        new_token_id = llama_sample_token_greedy(ctx->ctx , &candidates_p);
    } else {
        const int32_t top_k = (ctx->model)->top_k <= 0 ? llama_n_vocab(ctx->ctx) : (ctx->model)->top_k;
        const int32_t n_probs = 0; // Number of probabilities to keep - 0 = disabled
        const float tfs_z = 1.00f; // Tail free sampling - 1.0 = disabled
        const float typical_p = 1.00f; // Typical probability - 1.0 = disabled
        const float top_p = (ctx->model)->top_p; // Top p sampling - 1.0 = disabled

        // Temperature sampling
        size_t min_keep = std::max(1, n_probs);
        llama_sample_top_k(ctx->ctx, &candidates_p, top_k, min_keep);
        llama_sample_tail_free(ctx->ctx, &candidates_p, tfs_z, min_keep);
        llama_sample_typical(ctx->ctx, &candidates_p, typical_p, min_keep);
        llama_sample_top_p(ctx->ctx, &candidates_p, top_p, min_keep);
        llama_sample_temperature(ctx->ctx, &candidates_p, (ctx->model)->temperature);;
        new_token_id = llama_sample_token(ctx->ctx, &candidates_p);
    }

    if (new_token_id != eos_token && ctx->use_grammar) {
        llama_grammar_accept_token(ctx->ctx, (ctx->grammar)->grammar, new_token_id);
    }

    result = new_token_id;
  }
  void OnOK() {
    Napi::Env env = Napi::AsyncWorker::Env();
    Napi::Number resultValue = Napi::Number::New(env, static_cast<uint32_t>(result));
    Napi::Promise::Deferred::Resolve(resultValue);
  }
  void OnError(const Napi::Error& err) { Napi::Promise::Deferred::Reject(err.Value()); }
};

Napi::Value LLAMAContext::Eval(const Napi::CallbackInfo& info) {
  LLAMAContextEvalWorker* worker = new LLAMAContextEvalWorker(info, this);
  worker->Queue();
  return worker->Promise();
}

Napi::Value systemInfo(const Napi::CallbackInfo& info) { return Napi::String::From(info.Env(), llama_print_system_info()); }

Napi::Object registerCallback(Napi::Env env, Napi::Object exports) {
  llama_backend_init(false);
  exports.DefineProperties({
      Napi::PropertyDescriptor::Function("systemInfo", systemInfo),
  });
  LLAMAModel::init(exports);
  LLAMAGrammar::init(exports);
  LLAMAContext::init(exports);
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, registerCallback)
