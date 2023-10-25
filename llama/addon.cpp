#include <stddef.h>
#include <algorithm>
#include <sstream>
#include <vector>

#include "common.h"
#include "llama.h"
#include "common/grammar-parser.h"
#include "napi.h"

class LLAMAModel : public Napi::ObjectWrap<LLAMAModel> {
  public:
    llama_model_params model_params;
    llama_model* model;

    LLAMAModel(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAModel>(info) {
        model_params = llama_model_default_params();

        // Get the model path
        std::string modelPath = info[0].As<Napi::String>().Utf8Value();

        if (info.Length() > 1 && info[1].IsObject()) {
            Napi::Object options = info[1].As<Napi::Object>();

            if (options.Has("gpuLayers")) {
                model_params.n_gpu_layers = options.Get("gpuLayers").As<Napi::Number>().Int32Value();
            }

            if (options.Has("vocabOnly")) {
                model_params.vocab_only = options.Get("vocabOnly").As<Napi::Boolean>().Value();
            }

            if (options.Has("useMmap")) {
                model_params.use_mmap = options.Get("useMmap").As<Napi::Boolean>().Value();
            }

            if (options.Has("useMlock")) {
                model_params.use_mlock = options.Get("useMlock").As<Napi::Boolean>().Value();
            }
        }

        llama_backend_init(false);
        model = llama_load_model_from_file(modelPath.c_str(), model_params);

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
    }

    static void init(Napi::Object exports) {
        exports.Set("LLAMAGrammar", DefineClass(exports.Env(), "LLAMAGrammar", {}));
    }
};

class LLAMAGrammarEvaluationState : public Napi::ObjectWrap<LLAMAGrammarEvaluationState> {
  public:
    LLAMAGrammar* grammarDef;
    llama_grammar *grammar = nullptr;

    LLAMAGrammarEvaluationState(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAGrammarEvaluationState>(info) {
        grammarDef = Napi::ObjectWrap<LLAMAGrammar>::Unwrap(info[0].As<Napi::Object>());
        grammarDef->Ref();

        std::vector<const llama_grammar_element *> grammar_rules(grammarDef->parsed_grammar.c_rules());
        grammar = llama_grammar_init(
            grammar_rules.data(), grammar_rules.size(), grammarDef->parsed_grammar.symbol_ids.at("root")
        );
    }

    ~LLAMAGrammarEvaluationState() {
      grammarDef->Unref();

        if (grammar != nullptr) {
            llama_grammar_free(grammar);
            grammar = nullptr;
        }
    }

    static void init(Napi::Object exports) {
        exports.Set("LLAMAGrammarEvaluationState", DefineClass(exports.Env(), "LLAMAGrammarEvaluationState", {}));
    }
};

class LLAMAContext : public Napi::ObjectWrap<LLAMAContext> {
  public:
  LLAMAModel* model;
  llama_context_params context_params;
  llama_context* ctx;
  int n_cur = 0;

  LLAMAContext(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAContext>(info) {
    model = Napi::ObjectWrap<LLAMAModel>::Unwrap(info[0].As<Napi::Object>());
    model->Ref();

    context_params = llama_context_default_params();
    context_params.seed = -1;
    context_params.n_ctx = 4096;
    context_params.n_threads = 6;
    context_params.n_threads_batch == -1 ? context_params.n_threads : context_params.n_threads_batch;

    if (info.Length() > 1 && info[1].IsObject()) {
      Napi::Object options = info[1].As<Napi::Object>();

      if (options.Has("seed")) {
        context_params.seed = options.Get("seed").As<Napi::Number>().Int32Value();
      }

      if (options.Has("contextSize")) {
        context_params.n_ctx = options.Get("contextSize").As<Napi::Number>().Int32Value();
      }

      if (options.Has("batchSize")) {
        context_params.n_batch = options.Get("batchSize").As<Napi::Number>().Int32Value();
      }

      if (options.Has("f16Kv")) {
          context_params.f16_kv = options.Get("f16Kv").As<Napi::Boolean>().Value();
      }

      if (options.Has("logitsAll")) {
          context_params.logits_all = options.Get("logitsAll").As<Napi::Boolean>().Value();
      }

      if (options.Has("embedding")) {
        context_params.embedding = options.Get("embedding").As<Napi::Boolean>().Value();
      }

      if (options.Has("threads")) {
        context_params.n_threads = options.Get("threads").As<Napi::Number>().Int32Value();
        context_params.n_threads_batch == -1 ? context_params.n_threads : context_params.n_threads_batch;
      }
    }

    ctx = llama_new_context_with_model(model->model, context_params);
    Napi::MemoryManagement::AdjustExternalMemory(Env(), llama_get_state_size(ctx));
  }
  ~LLAMAContext() {
    Napi::MemoryManagement::AdjustExternalMemory(Env(), -(int64_t)llama_get_state_size(ctx));
    llama_free(ctx);
    model->Unref();
  }
  Napi::Value Encode(const Napi::CallbackInfo& info) {
    std::string text = info[0].As<Napi::String>().Utf8Value();

    std::vector<llama_token> tokens = llama_tokenize(ctx, text, false);

    Napi::Uint32Array result = Napi::Uint32Array::New(info.Env(), tokens.size());
    for (size_t i = 0; i < tokens.size(); ++i) { result[i] = static_cast<uint32_t>(tokens[i]); }

    return result;
  }
  Napi::Value Decode(const Napi::CallbackInfo& info) {
    Napi::Uint32Array tokens = info[0].As<Napi::Uint32Array>();

    // Create a stringstream for accumulating the decoded string.
    std::stringstream ss;

    // Decode each token and accumulate the result.
    for (size_t i = 0; i < tokens.ElementLength(); i++) {
        const std::string piece = llama_token_to_piece(ctx, (llama_token)tokens[i]);

        if (piece.empty()) {
            continue;
        }

        ss << piece;
    }

    return Napi::String::New(info.Env(), ss.str());
  }
  Napi::Value TokenBos(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_token_bos(model->model)); // TODO: move this to the model
  }
  Napi::Value TokenEos(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_token_eos(model->model)); // TODO: move this to the model
  }
  Napi::Value TokenNl(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_token_nl(model->model)); // TODO: move this to the model
  }
  Napi::Value GetContextSize(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_n_ctx(ctx));
  }
  Napi::Value GetTokenString(const Napi::CallbackInfo& info) {
    int token = info[0].As<Napi::Number>().Int32Value();
    std::stringstream ss;

    const char* str = llama_token_get_text(model->model, token); // TODO: move this to the model
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
                InstanceMethod("tokenNl", &LLAMAContext::TokenNl),
                InstanceMethod("getContextSize", &LLAMAContext::GetContextSize),
                InstanceMethod("getTokenString", &LLAMAContext::GetTokenString),
                InstanceMethod("eval", &LLAMAContext::Eval),
            }));
  }
};


class LLAMAContextEvalWorker : Napi::AsyncWorker, Napi::Promise::Deferred {
  LLAMAContext* ctx;
  LLAMAGrammarEvaluationState* grammar_evaluation_state;
  bool use_grammar = false;
  std::vector<llama_token> tokens;
  llama_token result;
  float temperature;
  int32_t top_k;
  float top_p;
  float repeat_penalty = 1.10f; // 1.0 = disabled
  float repeat_penalty_presence_penalty = 0.00f; // 0.0 = disabled
  float repeat_penalty_frequency_penalty = 0.00f; // 0.0 = disabled
  std::vector<llama_token> repeat_penalty_tokens;
  bool use_repeat_penalty = false;

  public:
  LLAMAContextEvalWorker(const Napi::CallbackInfo& info, LLAMAContext* ctx) : Napi::AsyncWorker(info.Env(), "LLAMAContextEvalWorker"), ctx(ctx), Napi::Promise::Deferred(info.Env()) {
    ctx->Ref();
    Napi::Uint32Array tokens = info[0].As<Napi::Uint32Array>();

    temperature = 0.0f;
    top_k = 40;
    top_p = 0.95f;

    if (info.Length() > 1 && info[1].IsObject()) {
      Napi::Object options = info[1].As<Napi::Object>();

      if (options.Has("temperature")) {
          temperature = options.Get("temperature").As<Napi::Number>().FloatValue();
      }

      if (options.Has("topK")) {
          top_k = options.Get("topK").As<Napi::Number>().Int32Value();
      }

      if (options.Has("topP")) {
          top_p = options.Get("topP").As<Napi::Number>().FloatValue();
      }

      if (options.Has("repeatPenalty")) {
          repeat_penalty = options.Get("repeatPenalty").As<Napi::Number>().FloatValue();
      }

      if (options.Has("repeatPenaltyTokens")) {
          Napi::Uint32Array repeat_penalty_tokens_uint32_array = options.Get("repeatPenaltyTokens").As<Napi::Uint32Array>();

          repeat_penalty_tokens.reserve(repeat_penalty_tokens_uint32_array.ElementLength());
          for (size_t i = 0; i < repeat_penalty_tokens_uint32_array.ElementLength(); i++) {
            repeat_penalty_tokens.push_back(static_cast<llama_token>(repeat_penalty_tokens_uint32_array[i]));
          }

          use_repeat_penalty = true;
      }

      if (options.Has("repeatPenaltyPresencePenalty")) {
          repeat_penalty_presence_penalty = options.Get("repeatPenaltyPresencePenalty").As<Napi::Number>().FloatValue();
      }

      if (options.Has("repeatPenaltyFrequencyPenalty")) {
          repeat_penalty_frequency_penalty = options.Get("repeatPenaltyFrequencyPenalty").As<Napi::Number>().FloatValue();
      }

      if (options.Has("grammarEvaluationState")) {
          grammar_evaluation_state = Napi::ObjectWrap<LLAMAGrammarEvaluationState>::Unwrap(options.Get("grammarEvaluationState").As<Napi::Object>());
          grammar_evaluation_state->Ref();
          use_grammar = true;
      }
    }

    this->tokens.reserve(tokens.ElementLength());
    for (size_t i = 0; i < tokens.ElementLength(); i++) { this->tokens.push_back(static_cast<llama_token>(tokens[i])); }
  }
  ~LLAMAContextEvalWorker() {
    ctx->Unref();

    if (use_grammar) {
        grammar_evaluation_state->Unref();
        use_grammar = false;
    }
  }
  using Napi::AsyncWorker::Queue;
  using Napi::Promise::Deferred::Promise;

  protected:
  void Execute() {
    llama_batch batch = llama_batch_init(tokens.size(), 0, 1);

    for (size_t i = 0; i < tokens.size(); i++) {
        llama_batch_add(batch, tokens[i], ctx->n_cur, { 0 }, false);

        ctx->n_cur++;
    }
    GGML_ASSERT(batch.n_tokens == (int) tokens.size());

    batch.logits[batch.n_tokens - 1] = true;

    // Perform the evaluation using llama_decode.
    int r = llama_decode(ctx->ctx, batch);

    llama_batch_free(batch);

    if (r != 0) {
      if (r == 1) {
        SetError("could not find a KV slot for the batch (try reducing the size of the batch or increase the context)");
      } else {
        SetError("Eval has failed");
      }

      return;
    }

    llama_token new_token_id = 0;

    // Select the best prediction.
    auto logits = llama_get_logits_ith(ctx->ctx, batch.n_tokens - 1);
    auto n_vocab = llama_n_vocab(ctx->model->model);

    std::vector<llama_token_data> candidates;
    candidates.reserve(n_vocab);

    for (llama_token token_id = 0; token_id < n_vocab; token_id++) {
      candidates.emplace_back(llama_token_data{ token_id, logits[token_id], 0.0f });
    }

    llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

    auto eos_token = llama_token_eos(ctx->model->model);

    if (use_repeat_penalty && !repeat_penalty_tokens.empty()) {
      llama_sample_repetition_penalties(
        ctx->ctx, &candidates_p, repeat_penalty_tokens.data(), repeat_penalty_tokens.size(), repeat_penalty,
        repeat_penalty_frequency_penalty, repeat_penalty_presence_penalty
      );
    }

    if (use_grammar && (grammar_evaluation_state)->grammar != nullptr) {
        llama_sample_grammar(ctx->ctx, &candidates_p, (grammar_evaluation_state)->grammar);
    }

    if (temperature <= 0) {
        new_token_id = llama_sample_token_greedy(ctx->ctx , &candidates_p);
    } else {
        const int32_t resolved_top_k = top_k <= 0 ? llama_n_vocab(ctx->model->model) : std::min(top_k, llama_n_vocab(ctx->model->model));
        const int32_t n_probs = 0; // Number of probabilities to keep - 0 = disabled
        const float tfs_z = 1.00f; // Tail free sampling - 1.0 = disabled
        const float typical_p = 1.00f; // Typical probability - 1.0 = disabled
        const float resolved_top_p = top_p; // Top p sampling - 1.0 = disabled

        // Temperature sampling
        size_t min_keep = std::max(1, n_probs);
        llama_sample_top_k(ctx->ctx, &candidates_p, resolved_top_k, min_keep);
        llama_sample_tail_free(ctx->ctx, &candidates_p, tfs_z, min_keep);
        llama_sample_typical(ctx->ctx, &candidates_p, typical_p, min_keep);
        llama_sample_top_p(ctx->ctx, &candidates_p, resolved_top_p, min_keep);
        llama_sample_temperature(ctx->ctx, &candidates_p, temperature);
        new_token_id = llama_sample_token(ctx->ctx, &candidates_p);
    }

    if (new_token_id != eos_token && use_grammar && (grammar_evaluation_state)->grammar != nullptr) {
        llama_grammar_accept_token(ctx->ctx, (grammar_evaluation_state)->grammar, new_token_id);
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
  LLAMAGrammarEvaluationState::init(exports);
  LLAMAContext::init(exports);
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, registerCallback)
