#include <sstream>
#include "addonGlobals.h"
#include "globals/addonLog.h"
#include "globals/addonProgress.h"
#include "common/common.h"
#include "llama.h"
#include "AddonModel.h"
#include "AddonModelData.h"
#include "AddonModelLora.h"

static Napi::Value getNapiToken(const Napi::CallbackInfo& info, const llama_vocab* vocab, llama_token token) {
    if (token < 0 || token == LLAMA_TOKEN_NULL) {
        return Napi::Number::From(info.Env(), -1);
    }

    auto tokenAttributes = llama_vocab_get_attr(vocab, token);

    if (tokenAttributes & LLAMA_TOKEN_ATTR_UNDEFINED || tokenAttributes & LLAMA_TOKEN_ATTR_UNKNOWN) {
        return Napi::Number::From(info.Env(), -1);
    }

    return Napi::Number::From(info.Env(), token);
}

static Napi::Value getNapiControlToken(const Napi::CallbackInfo& info, const llama_vocab* vocab, llama_token token) {
    if (token < 0) {
        return Napi::Number::From(info.Env(), -1);
    }

    auto tokenAttributes = llama_vocab_get_attr(vocab, token);

    if (!(tokenAttributes & LLAMA_TOKEN_ATTR_CONTROL) && !(tokenAttributes & LLAMA_TOKEN_ATTR_UNDEFINED)) {
        return Napi::Number::From(info.Env(), -1);
    }

    return Napi::Number::From(info.Env(), token);
}

static bool llamaModelParamsProgressCallback(float progress, void * user_data) {
    AddonModel* addonModel = (AddonModel *) user_data;
    unsigned percentage = (unsigned) (100 * progress);

    if (percentage > addonModel->modelLoadPercentage) {
        addonModel->modelLoadPercentage = percentage;

        // original llama.cpp logs
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_INFO, ".", nullptr);
        if (percentage >= 100) {
            addonLlamaCppLogCallback(GGML_LOG_LEVEL_INFO, "\n", nullptr);
        }
    }

    if (progress > addonModel->rawModelLoadPercentage) {
        addonModel->rawModelLoadPercentage = progress;

        if (addonModel->onLoadProgressEventCallbackSet) {
            addon_progress_event* data = new addon_progress_event {
                progress
            };

            auto status = addonModel->addonThreadSafeOnLoadProgressEventCallback.NonBlockingCall(data);

            if (status != napi_ok) {
                delete data;
            }
        }
    }

    return !(addonModel->abortModelLoad);
}

class AddonModelLoadModelWorker : public Napi::AsyncWorker {
    public:
        AddonModel* model;

        AddonModelLoadModelWorker(const Napi::Env& env, AddonModel* model)
            : Napi::AsyncWorker(env, "AddonModelLoadModelWorker"),
              model(model),
              deferred(Napi::Promise::Deferred::New(env)) {
            model->Ref();
        }
        ~AddonModelLoadModelWorker() {
            model->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                model->model = llama_model_load_from_file(model->modelPath.c_str(), model->model_params);
                model->vocab = llama_model_get_vocab(model->model);

                model->modelLoaded = model->model != nullptr && model->model != NULL;
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_model_load_from_file\"");
            }
        }
        void OnOK() {
            if (model->modelLoaded) {
                uint64_t modelSize = llama_model_size(model->model);
                adjustNapiExternalMemoryAdd(Env(), modelSize);
                model->loadedModelSize = modelSize;
            }

            deferred.Resolve(Napi::Boolean::New(Env(), model->modelLoaded));
            if (model->onLoadProgressEventCallbackSet) {
                model->addonThreadSafeOnLoadProgressEventCallback.Release();
            }
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

class AddonModelUnloadModelWorker : public Napi::AsyncWorker {
    public:
        AddonModel* model;

        AddonModelUnloadModelWorker(const Napi::Env& env, AddonModel* model)
            : Napi::AsyncWorker(env, "AddonModelUnloadModelWorker"),
              model(model),
              deferred(Napi::Promise::Deferred::New(env)) {
            model->Ref();
        }
        ~AddonModelUnloadModelWorker() {
            model->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                llama_model_free(model->model);
                model->modelLoaded = false;

                model->dispose();
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_model_free\"");
            }
        }
        void OnOK() {
            adjustNapiExternalMemorySubtract(Env(), model->loadedModelSize);
            model->loadedModelSize = 0;

            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

class AddonModelLoadLoraWorker : public Napi::AsyncWorker {
    public:
        AddonModelLora* modelLora;

        AddonModelLoadLoraWorker(
            const Napi::Env& env,
            AddonModelLora* modelLora
        )
            : Napi::AsyncWorker(env, "AddonModelLoadLoraWorker"),
              modelLora(modelLora),
              deferred(Napi::Promise::Deferred::New(env)) {
            modelLora->model->Ref();
            modelLora->Ref();
        }
        ~AddonModelLoadLoraWorker() {
            modelLora->model->Unref();
            modelLora->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                const auto loraAdapter = llama_adapter_lora_init(modelLora->model->model, modelLora->loraFilePath.c_str());

                if (loraAdapter == nullptr) {
                    SetError(
                        std::string(
                            std::string("Failed to initialize LoRA adapter \"" + modelLora->loraFilePath + "\"")
                        )
                    );
                    return;
                }

                modelLora->lora_adapter = loraAdapter;
                modelLora->model->Ref();

                if (modelLora->model->data != nullptr) {
                    modelLora->model->data->loraAdapters.insert(modelLora);
                } else {
                    modelLora->dispose(true);
                    SetError("Model data is not initialized");
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_adapter_lora_init\"");
            }
        }
        void OnOK() {
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

AddonModel::AddonModel(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonModel>(info) {
    data = new AddonModelData();
    model_params = llama_model_default_params();

    // Get the model path
    modelPath = info[0].As<Napi::String>().Utf8Value();

    if (info.Length() > 1 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();

        if (options.Has("addonExports")) {
            addonExportsRef = Napi::Persistent(options.Get("addonExports").As<Napi::Object>());
            hasAddonExportsRef = true;
        }

        if (options.Has("gpuLayers")) {
            model_params.n_gpu_layers = options.Get("gpuLayers").As<Napi::Number>().Int32Value();
        }

        if (options.Has("vocabOnly")) {
            model_params.vocab_only = options.Get("vocabOnly").As<Napi::Boolean>().Value();
        }

        if (options.Has("useMmap")) {
            model_params.use_mmap = options.Get("useMmap").As<Napi::Boolean>().Value();
        }

        if (options.Has("useDirectIo")) {
            model_params.use_direct_io = options.Get("useDirectIo").As<Napi::Boolean>().Value();
        }

        if (options.Has("useMlock")) {
            model_params.use_mlock = options.Get("useMlock").As<Napi::Boolean>().Value();
        }

        if (options.Has("checkTensors")) {
            model_params.check_tensors = options.Get("checkTensors").As<Napi::Boolean>().Value();
        }

        if (options.Has("onLoadProgress")) {
            auto onLoadProgressJSCallback = options.Get("onLoadProgress").As<Napi::Function>();
            if (onLoadProgressJSCallback.IsFunction()) {
                AddonThreadSafeProgressCallbackFunctionContext* context = new Napi::Reference<Napi::Value>(Napi::Persistent(info.This()));
                addonThreadSafeOnLoadProgressEventCallback = AddonThreadSafeProgressEventCallbackFunction::New(
                    info.Env(),
                    onLoadProgressJSCallback,
                    "onLoadProgressCallback",
                    0,
                    1,
                    context,
                    [](Napi::Env, AddonModel* addonModel, AddonThreadSafeProgressCallbackFunctionContext* ctx) {
                        addonModel->onLoadProgressEventCallbackSet = false;

                        delete ctx;
                    },
                    this
                );
                onLoadProgressEventCallbackSet = true;
            }
        }

        if (options.Has("hasLoadAbortSignal")) {
            hasLoadAbortSignal = options.Get("hasLoadAbortSignal").As<Napi::Boolean>().Value();
        }

        if (options.Has("overridesList")) {
            Napi::Array overridesList = options.Get("overridesList").As<Napi::Array>();
            kv_overrides.reserve(overridesList.Length());

            for (uint32_t i = 0; i < overridesList.Length(); i++) {
                Napi::Array overrideItem = overridesList.Get(i).As<Napi::Array>();
                auto key = overrideItem.Get((uint32_t)0).As<Napi::String>().Utf8Value();
                auto value = overrideItem.Get((uint32_t)1);

                if (key.length() > 127) {
                    continue;
                }

                llama_model_kv_override kvo;
                std::strncpy(kvo.key, key.c_str(), key.length());
                kvo.key[key.length()] = 0;

                if (value.IsString()) {
                    auto valueString = value.As<Napi::String>().Utf8Value();
                    if (valueString.length() > 127) {
                        continue;
                    }

                    kvo.tag = LLAMA_KV_OVERRIDE_TYPE_STR;
                    std::strncpy(kvo.val_str, valueString.c_str(), valueString.length());
                    kvo.val_str[valueString.length()] = 0;

                    fputs(std::string("Override: " + key + " = " + valueString + "\n").c_str(), stdout);
                    fflush(stdout);
                } else if (value.IsNumber() || value.IsBigInt()) {
                    auto numberType = overrideItem.Get((uint32_t)2).As<Napi::Number>().Int32Value();
                    if (numberType == 0) {
                        kvo.tag = LLAMA_KV_OVERRIDE_TYPE_INT;
                        kvo.val_i64 = value.As<Napi::Number>().Int64Value();
                    } else {
                        kvo.tag = LLAMA_KV_OVERRIDE_TYPE_FLOAT;
                        kvo.val_f64 = value.As<Napi::Number>().DoubleValue();
                    }

                    continue;
                } else if (value.IsBoolean()) {
                    kvo.tag = LLAMA_KV_OVERRIDE_TYPE_BOOL;
                    kvo.val_bool = value.As<Napi::Boolean>().Value();
                }

                kv_overrides.emplace_back(std::move(kvo));
            }

            if (!kv_overrides.empty()) {
                kv_overrides.emplace_back();
                kv_overrides.back().key[0] = 0;
            }

            model_params.kv_overrides = kv_overrides.data();
        }

        if (onLoadProgressEventCallbackSet || hasLoadAbortSignal) {
            model_params.progress_callback_user_data = &(*this);
            model_params.progress_callback = llamaModelParamsProgressCallback;
        }
    }
}

AddonModel::~AddonModel() {
    dispose();
}
void AddonModel::dispose() {
    if (disposed) {
        return;
    }

    disposed = true;
    
    if (data != nullptr) {
        auto currentData = data;
        data = nullptr;
        delete currentData;
    }

    if (modelLoaded) {
        modelLoaded = false;
        llama_model_free(model);

        adjustNapiExternalMemorySubtract(Env(), loadedModelSize);
        loadedModelSize = 0;
    }

    if (hasAddonExportsRef) {
        addonExportsRef.Unref();
        hasAddonExportsRef = false;
    }
}

Napi::Value AddonModel::Init(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    AddonModelLoadModelWorker* worker = new AddonModelLoadModelWorker(this->Env(), this);
    worker->Queue();
    return worker->GetPromise();
}
Napi::Value AddonModel::LoadLora(const Napi::CallbackInfo& info) {
    AddonModelLora* modelLora = Napi::ObjectWrap<AddonModelLora>::Unwrap(info[0].As<Napi::Object>());
    AddonModelLoadLoraWorker* worker = new AddonModelLoadLoraWorker(this->Env(), modelLora);
    worker->Queue();
    return worker->GetPromise();
}
Napi::Value AddonModel::AbortActiveModelLoad(const Napi::CallbackInfo& info) {
    abortModelLoad = true;
    return info.Env().Undefined();
}
Napi::Value AddonModel::Dispose(const Napi::CallbackInfo& info) {
    if (disposed) {
        return info.Env().Undefined();
    }

    if (modelLoaded) {
        modelLoaded = false;

        AddonModelUnloadModelWorker* worker = new AddonModelUnloadModelWorker(this->Env(), this);
        worker->Queue();
        return worker->GetPromise();
    } else {
        dispose();

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(info.Env());
        deferred.Resolve(info.Env().Undefined());
        return deferred.Promise();
    }
}

Napi::Value AddonModel::Tokenize(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    std::string text = info[0].As<Napi::String>().Utf8Value();
    bool specialTokens = info[1].As<Napi::Boolean>().Value();

    std::vector<llama_token> tokens = common_tokenize(vocab, text, false, specialTokens);

    Napi::Uint32Array result = Napi::Uint32Array::New(info.Env(), tokens.size());
    for (size_t i = 0; i < tokens.size(); ++i) {
        result[i] = static_cast<uint32_t>(tokens[i]);
    }

    return result;
}
Napi::Value AddonModel::Detokenize(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    Napi::Uint32Array tokens = info[0].As<Napi::Uint32Array>();
    bool decodeSpecialTokens = info.Length() > 0
        ? info[1].As<Napi::Boolean>().Value()
        : false;

    std::string result;
    result.resize(std::max(result.capacity(), tokens.ElementLength()));

    int n_chars = llama_detokenize(vocab, (llama_token*)tokens.Data(), tokens.ElementLength(), &result[0], result.size(), false, decodeSpecialTokens);
    if (n_chars < 0) {
        result.resize(-n_chars);
        n_chars = llama_detokenize(vocab, (llama_token*)tokens.Data(), tokens.ElementLength(), &result[0], result.size(), false, decodeSpecialTokens);
        GGML_ASSERT(n_chars <= result.size());  // whitespace trimming is performed after per-token detokenization
    }

    result.resize(n_chars);

    return Napi::String::New(info.Env(), result);
}

Napi::Value AddonModel::GetTrainContextSize(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return Napi::Number::From(info.Env(), llama_model_n_ctx_train(model));
}

Napi::Value AddonModel::GetEmbeddingVectorSize(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return Napi::Number::From(info.Env(), llama_model_n_embd(model));
}

Napi::Value AddonModel::GetTotalSize(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return Napi::Number::From(info.Env(), llama_model_size(model));
}

Napi::Value AddonModel::GetTotalParameters(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return Napi::Number::From(info.Env(), llama_model_n_params(model));
}

Napi::Value AddonModel::GetModelDescription(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    char model_desc[128];
    int actual_length = llama_model_desc(model, model_desc, sizeof(model_desc));

    return Napi::String::New(info.Env(), model_desc, actual_length);
}

Napi::Value AddonModel::TokenBos(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiControlToken(info, vocab, llama_vocab_bos(vocab));
}
Napi::Value AddonModel::TokenEos(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiControlToken(info, vocab, llama_vocab_eos(vocab));
}
Napi::Value AddonModel::TokenNl(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiToken(info, vocab, llama_vocab_nl(vocab));
}
Napi::Value AddonModel::PrefixToken(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiToken(info, vocab, llama_vocab_fim_pre(vocab));
}
Napi::Value AddonModel::MiddleToken(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiToken(info, vocab, llama_vocab_fim_mid(vocab));
}
Napi::Value AddonModel::SuffixToken(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiToken(info, vocab, llama_vocab_fim_suf(vocab));
}
Napi::Value AddonModel::EotToken(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiToken(info, vocab, llama_vocab_eot(vocab));
}
Napi::Value AddonModel::SepToken(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return getNapiToken(info, vocab, llama_vocab_sep(vocab));
}
Napi::Value AddonModel::GetTokenString(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    int token = info[0].As<Napi::Number>().Int32Value();
    std::stringstream ss;

    const char* str = llama_vocab_get_text(vocab, token);
    if (str == nullptr) {
        return info.Env().Undefined();
    }

    ss << str;

    return Napi::String::New(info.Env(), ss.str());
}

Napi::Value AddonModel::GetTokenAttributes(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    if (info[0].IsNumber() == false) {
        return Napi::Number::From(info.Env(), int32_t(LLAMA_TOKEN_ATTR_UNDEFINED));
    }

    int token = info[0].As<Napi::Number>().Int32Value();
    auto tokenAttributes = llama_vocab_get_attr(vocab, token);

    return Napi::Number::From(info.Env(), int32_t(tokenAttributes));
}
Napi::Value AddonModel::IsEogToken(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    if (info[0].IsNumber() == false) {
        return Napi::Boolean::New(info.Env(), false);
    }

    int token = info[0].As<Napi::Number>().Int32Value();

    return Napi::Boolean::New(info.Env(), llama_vocab_is_eog(vocab, token));
}
Napi::Value AddonModel::GetVocabularyType(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    auto vocabularyType = llama_vocab_type(vocab);

    return Napi::Number::From(info.Env(), int32_t(vocabularyType));
}
Napi::Value AddonModel::ShouldPrependBosToken(const Napi::CallbackInfo& info) {
    const bool addBos = llama_vocab_get_add_bos(vocab);

    return Napi::Boolean::New(info.Env(), addBos);
}
Napi::Value AddonModel::ShouldAppendEosToken(const Napi::CallbackInfo& info) {
    const bool addEos = llama_vocab_get_add_eos(vocab);

    return Napi::Boolean::New(info.Env(), addEos);
}

Napi::Value AddonModel::GetModelSize(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), llama_model_size(model));
}

void AddonModel::init(Napi::Object exports) {
    exports.Set(
        "AddonModel",
        DefineClass(
            exports.Env(),
            "AddonModel",
            {
                InstanceMethod("init", &AddonModel::Init),
                InstanceMethod("loadLora", &AddonModel::LoadLora),
                InstanceMethod("abortActiveModelLoad", &AddonModel::AbortActiveModelLoad),
                InstanceMethod("tokenize", &AddonModel::Tokenize),
                InstanceMethod("detokenize", &AddonModel::Detokenize),
                InstanceMethod("getTrainContextSize", &AddonModel::GetTrainContextSize),
                InstanceMethod("getEmbeddingVectorSize", &AddonModel::GetEmbeddingVectorSize),
                InstanceMethod("getTotalSize", &AddonModel::GetTotalSize),
                InstanceMethod("getTotalParameters", &AddonModel::GetTotalParameters),
                InstanceMethod("getModelDescription", &AddonModel::GetModelDescription),
                InstanceMethod("tokenBos", &AddonModel::TokenBos),
                InstanceMethod("tokenEos", &AddonModel::TokenEos),
                InstanceMethod("tokenNl", &AddonModel::TokenNl),
                InstanceMethod("prefixToken", &AddonModel::PrefixToken),
                InstanceMethod("middleToken", &AddonModel::MiddleToken),
                InstanceMethod("suffixToken", &AddonModel::SuffixToken),
                InstanceMethod("eotToken", &AddonModel::EotToken),
                InstanceMethod("sepToken", &AddonModel::SepToken),
                InstanceMethod("getTokenString", &AddonModel::GetTokenString),
                InstanceMethod("getTokenAttributes", &AddonModel::GetTokenAttributes),
                InstanceMethod("isEogToken", &AddonModel::IsEogToken),
                InstanceMethod("getVocabularyType", &AddonModel::GetVocabularyType),
                InstanceMethod("shouldPrependBosToken", &AddonModel::ShouldPrependBosToken),
                InstanceMethod("shouldAppendEosToken", &AddonModel::ShouldAppendEosToken),
                InstanceMethod("getModelSize", &AddonModel::GetModelSize),
                InstanceMethod("dispose", &AddonModel::Dispose),
            }
        )
    );
}
