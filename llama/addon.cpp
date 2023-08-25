#include <stddef.h>
#include <algorithm>
#include <sstream>
#include <vector>

#include "llama.h"
#include "napi.h"

class LLAMAModel : public Napi::ObjectWrap<LLAMAModel> {
  public:
    llama_context_params params;
    llama_model* model;

    LLAMAModel(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAModel>(info) {
        params = llama_context_default_params();
        params.seed = -1;
        params.n_ctx = 4096;

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

class LLAMAContext : public Napi::ObjectWrap<LLAMAContext> {
  public:
  LLAMAModel* model;
  llama_context* ctx;
  LLAMAContext(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LLAMAContext>(info) {
    model = Napi::ObjectWrap<LLAMAModel>::Unwrap(info[0].As<Napi::Object>());
    model->Ref();
    ctx = llama_new_context_with_model(model->model, model->params);
    Napi::MemoryManagement::AdjustExternalMemory(Env(), llama_get_state_size(ctx));
  }
  ~LLAMAContext() {
    Napi::MemoryManagement::AdjustExternalMemory(Env(), -(int64_t)llama_get_state_size(ctx));
    llama_free(ctx);
    model->Unref();
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
  Napi::Value GetMaxContextSize(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_n_ctx(ctx));
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
                InstanceMethod("getMaxContextSize", &LLAMAContext::GetMaxContextSize),
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

    new_token_id = llama_sample_token_greedy(ctx->ctx , &candidates_p);

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
  LLAMAContext::init(exports);
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, registerCallback)
