#include <stddef.h>

#include <algorithm>
#include <sstream>
#include <vector>
#include <unordered_map>

#include "common.h"
#include "common/grammar-parser.h"
#include "llama.h"
#include "napi.h"

#ifdef GPU_INFO_USE_CUDA
#  include "gpuInfo/cuda-gpu-info.h"
#endif
#ifdef GPU_INFO_USE_VULKAN
#  include "gpuInfo/vulkan-gpu-info.h"
#endif
#ifdef GPU_INFO_USE_METAL
#  include "gpuInfo/metal-gpu-info.h"
#endif


struct addon_logger_log {
    public:
        const int logLevelNumber;
        const std::stringstream* stringStream;
};

static void addonLlamaCppLogCallback(ggml_log_level level, const char* text, void* user_data);

using AddonThreadSafeLogCallbackFunctionContext = Napi::Reference<Napi::Value>;
void addonCallJsLogCallback(
    Napi::Env env, Napi::Function callback, AddonThreadSafeLogCallbackFunctionContext* context, addon_logger_log* data
);
using AddonThreadSafeLogCallbackFunction =
    Napi::TypedThreadSafeFunction<AddonThreadSafeLogCallbackFunctionContext, addon_logger_log, addonCallJsLogCallback>;


struct addon_progress_event {
    public:
        const float progress;
};

using AddonThreadSafeProgressCallbackFunctionContext = Napi::Reference<Napi::Value>;
void addonCallJsProgressCallback(
    Napi::Env env, Napi::Function callback, AddonThreadSafeProgressCallbackFunctionContext* context, addon_progress_event* data
);
using AddonThreadSafeProgressEventCallbackFunction =
    Napi::TypedThreadSafeFunction<AddonThreadSafeProgressCallbackFunctionContext, addon_progress_event, addonCallJsProgressCallback>;


AddonThreadSafeLogCallbackFunction addonThreadSafeLoggerCallback;
bool addonJsLoggerCallbackSet = false;
int addonLoggerLogLevel = 5;
bool backendInitialized = false;
bool backendDisposed = false;

void addonCallJsProgressCallback(
    Napi::Env env, Napi::Function callback, AddonThreadSafeProgressCallbackFunctionContext* context, addon_progress_event* data
) {
    if (env != nullptr && callback != nullptr && addonJsLoggerCallbackSet) {
        try {
            callback.Call({Napi::Number::New(env, data->progress)});
        } catch (const Napi::Error& e) {}
    }

    if (data != nullptr) {
        delete data;
    }
}

static uint64_t calculateBatchMemorySize(int32_t n_tokens_alloc, int32_t embd, int32_t n_seq_max) {
    uint64_t totalSize = 0;

    if (embd) {
        totalSize += sizeof(float) * n_tokens_alloc * embd;
    } else {
        totalSize += sizeof(llama_token) * n_tokens_alloc;
    }

    totalSize += sizeof(llama_pos) * n_tokens_alloc;
    totalSize += sizeof(int32_t) * n_tokens_alloc;
    totalSize += sizeof(llama_seq_id *) * (n_tokens_alloc + 1);

    totalSize += sizeof(llama_seq_id) * n_seq_max * n_tokens_alloc;

    totalSize += sizeof(int8_t) * n_tokens_alloc;

    return totalSize;
}

static void adjustNapiExternalMemoryAdd(Napi::Env env, uint64_t size) {
    const uint64_t chunkSize = std::numeric_limits<int64_t>::max();
    while (size > 0) {
        int64_t adjustSize = std::min(size, chunkSize);
        Napi::MemoryManagement::AdjustExternalMemory(env, adjustSize);
        size -= adjustSize;
    }
}

static void adjustNapiExternalMemorySubtract(Napi::Env env, uint64_t size) {
    const uint64_t chunkSize = std::numeric_limits<int64_t>::max();
    while (size > 0) {
        int64_t adjustSize = std::min(size, chunkSize);
        Napi::MemoryManagement::AdjustExternalMemory(env, -adjustSize);
        size -= adjustSize;
    }
}

#ifdef GPU_INFO_USE_CUDA
void logCudaError(const char* message) {
    addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, (std::string("CUDA error: ") + std::string(message)).c_str(), nullptr);
}
#endif
#ifdef GPU_INFO_USE_VULKAN
void logVulkanWarning(const char* message) {
    addonLlamaCppLogCallback(GGML_LOG_LEVEL_WARN, (std::string("Vulkan warning: ") + std::string(message)).c_str(), nullptr);
}
#endif

Napi::Value getGpuVramInfo(const Napi::CallbackInfo& info) {
    uint64_t total = 0;
    uint64_t used = 0;

#ifdef GPU_INFO_USE_CUDA
    size_t cudaDeviceTotal = 0;
    size_t cudaDeviceUsed = 0;
    bool cudeGetInfoSuccess = gpuInfoGetTotalCudaDevicesInfo(&cudaDeviceTotal, &cudaDeviceUsed, logCudaError);

    if (cudeGetInfoSuccess) {
        total += cudaDeviceTotal;
        used += cudaDeviceUsed;
    }
#endif

#ifdef GPU_INFO_USE_VULKAN
    uint64_t vulkanDeviceTotal = 0;
    uint64_t vulkanDeviceUsed = 0;
    const bool vulkanDeviceSupportsMemoryBudgetExtension = gpuInfoGetTotalVulkanDevicesInfo(&vulkanDeviceTotal, &vulkanDeviceUsed, logVulkanWarning);

    if (vulkanDeviceSupportsMemoryBudgetExtension) {
        total += vulkanDeviceTotal;
        used += vulkanDeviceUsed;
    }
#endif

#ifdef GPU_INFO_USE_METAL
    uint64_t metalDeviceTotal = 0;
    uint64_t metalDeviceUsed = 0;
    getMetalGpuInfo(&metalDeviceTotal, &metalDeviceUsed);

    total += metalDeviceTotal;
    used += metalDeviceUsed;
#endif

    Napi::Object result = Napi::Object::New(info.Env());
    result.Set("total", Napi::Number::From(info.Env(), total));
    result.Set("used", Napi::Number::From(info.Env(), used));

    return result;
}

Napi::Value getGpuDeviceInfo(const Napi::CallbackInfo& info) {
    std::vector<std::string> deviceNames;

#ifdef GPU_INFO_USE_CUDA
    gpuInfoGetCudaDeviceNames(&deviceNames, logCudaError);
#endif

#ifdef GPU_INFO_USE_VULKAN
    gpuInfoGetVulkanDeviceNames(&deviceNames, logVulkanWarning);
#endif

#ifdef GPU_INFO_USE_METAL
    getMetalGpuDeviceNames(&deviceNames);
#endif

    Napi::Object result = Napi::Object::New(info.Env());

    Napi::Array deviceNamesNapiArray = Napi::Array::New(info.Env(), deviceNames.size());
    for (size_t i = 0; i < deviceNames.size(); ++i) {
        deviceNamesNapiArray[i] = Napi::String::New(info.Env(), deviceNames[i]);
    }
    result.Set("deviceNames", deviceNamesNapiArray);

    return result;
}

Napi::Value getGpuType(const Napi::CallbackInfo& info) {
#ifdef GPU_INFO_USE_CUDA
    return Napi::String::New(info.Env(), "cuda");
#endif

#ifdef GPU_INFO_USE_VULKAN
    return Napi::String::New(info.Env(), "vulkan");
#endif

#ifdef GPU_INFO_USE_METAL
    return Napi::String::New(info.Env(), "metal");
#endif

    return info.Env().Undefined();
}

static Napi::Value getNapiToken(const Napi::CallbackInfo& info, llama_model* model, llama_token token) {
    if (token < 0) {
        return Napi::Number::From(info.Env(), -1);
    }

    auto tokenAttributes = llama_token_get_attr(model, token);

    if (tokenAttributes & LLAMA_TOKEN_ATTR_UNDEFINED || tokenAttributes & LLAMA_TOKEN_ATTR_UNKNOWN) {
        return Napi::Number::From(info.Env(), -1);
    }

    return Napi::Number::From(info.Env(), token);
}

static Napi::Value getNapiControlToken(const Napi::CallbackInfo& info, llama_model* model, llama_token token) {
    if (token < 0) {
        return Napi::Number::From(info.Env(), -1);
    }

    auto tokenAttributes = llama_token_get_attr(model, token);

    if (!(tokenAttributes & LLAMA_TOKEN_ATTR_CONTROL) && !(tokenAttributes & LLAMA_TOKEN_ATTR_UNDEFINED)) {
        return Napi::Number::From(info.Env(), -1);
    }

    return Napi::Number::From(info.Env(), token);
}

static bool llamaModelParamsProgressCallback(float progress, void * user_data);

class AddonModel : public Napi::ObjectWrap<AddonModel> {
    public:
        llama_model_params model_params;
        llama_model* model;
        uint64_t loadedModelSize = 0;
        Napi::Reference<Napi::Object> addonExportsRef;
        bool hasAddonExportsRef = false;

        std::string modelPath;
        bool modelLoaded = false;
        bool abortModelLoad = false;
        bool model_load_stopped = false;
        float rawModelLoadPercentage = 0;
        unsigned modelLoadPercentage = 0;
        AddonThreadSafeProgressEventCallbackFunction addonThreadSafeOnLoadProgressEventCallback;
        bool onLoadProgressEventCallbackSet = false;
        bool hasLoadAbortSignal = false;

        bool disposed = false;

        AddonModel(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonModel>(info) {
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

                if (onLoadProgressEventCallbackSet || hasLoadAbortSignal) {
                    model_params.progress_callback_user_data = &(*this);
                    model_params.progress_callback = llamaModelParamsProgressCallback;
                }
            }
        }

        ~AddonModel() {
            dispose();
        }

        void dispose() {
            if (disposed) {
                return;
            }

            disposed = true;
            if (modelLoaded) {
                modelLoaded = false;
                llama_free_model(model);

                adjustNapiExternalMemorySubtract(Env(), loadedModelSize);
                loadedModelSize = 0;
            }

            if (hasAddonExportsRef) {
                addonExportsRef.Unref();
                hasAddonExportsRef = false;
            }
        }

        Napi::Value Init(const Napi::CallbackInfo& info);
        Napi::Value LoadLora(const Napi::CallbackInfo& info);
        Napi::Value AbortActiveModelLoad(const Napi::CallbackInfo& info) {
            abortModelLoad = true;
            return info.Env().Undefined();
        }
        Napi::Value Dispose(const Napi::CallbackInfo& info);

        Napi::Value Tokenize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            std::string text = info[0].As<Napi::String>().Utf8Value();
            bool specialTokens = info[1].As<Napi::Boolean>().Value();

            std::vector<llama_token> tokens = llama_tokenize(model, text, false, specialTokens);

            Napi::Uint32Array result = Napi::Uint32Array::New(info.Env(), tokens.size());
            for (size_t i = 0; i < tokens.size(); ++i) {
                result[i] = static_cast<uint32_t>(tokens[i]);
            }

            return result;
        }
        Napi::Value Detokenize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            Napi::Uint32Array tokens = info[0].As<Napi::Uint32Array>();
            bool decodeSpecialTokens = info.Length() > 0
                ? info[1].As<Napi::Boolean>().Value()
                : false;

            std::vector<char> result(8, 0);
            const int n_length = llama_detokenize(model, (llama_token*)tokens.Data(), tokens.ElementLength(), result.data(), result.size(), false, decodeSpecialTokens);

            if (n_length < 0) {
                result.resize(-n_length);
                int check = llama_detokenize(model, (llama_token*)tokens.Data(), tokens.ElementLength(), result.data(), result.size(), false, decodeSpecialTokens);
                GGML_ASSERT(check == -n_length);
            } else {
                result.resize(n_length);
            }

            return Napi::String::New(info.Env(), result.data(), result.size());
        }

        Napi::Value GetTrainContextSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_n_ctx_train(model));
        }

        Napi::Value GetEmbeddingVectorSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_n_embd(model));
        }

        Napi::Value GetTotalSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_model_size(model));
        }

        Napi::Value GetTotalParameters(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_model_n_params(model));
        }

        Napi::Value GetModelDescription(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            char model_desc[128];
            int actual_length = llama_model_desc(model, model_desc, sizeof(model_desc));

            return Napi::String::New(info.Env(), model_desc, actual_length);
        }

        Napi::Value TokenBos(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return getNapiControlToken(info, model, llama_token_bos(model));
        }
        Napi::Value TokenEos(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return getNapiControlToken(info, model, llama_token_eos(model));
        }
        Napi::Value TokenNl(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return getNapiToken(info, model, llama_token_nl(model));
        }
        Napi::Value PrefixToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return getNapiControlToken(info, model, llama_token_prefix(model));
        }
        Napi::Value MiddleToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return getNapiControlToken(info, model, llama_token_middle(model));
        }
        Napi::Value SuffixToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return getNapiControlToken(info, model, llama_token_suffix(model));
        }
        Napi::Value EotToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return getNapiControlToken(info, model, llama_token_eot(model));
        }
        Napi::Value GetTokenString(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int token = info[0].As<Napi::Number>().Int32Value();
            std::stringstream ss;

            const char* str = llama_token_get_text(model, token);
            if (str == nullptr) {
                return info.Env().Undefined();
            }

            ss << str;

            return Napi::String::New(info.Env(), ss.str());
        }

        Napi::Value GetTokenAttributes(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            if (info[0].IsNumber() == false) {
                return Napi::Number::From(info.Env(), int32_t(LLAMA_TOKEN_ATTR_UNDEFINED));
            }

            int token = info[0].As<Napi::Number>().Int32Value();
            auto tokenAttributes = llama_token_get_attr(model, token);

            return Napi::Number::From(info.Env(), int32_t(tokenAttributes));
        }
        Napi::Value IsEogToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            if (info[0].IsNumber() == false) {
                return Napi::Boolean::New(info.Env(), false);
            }

            int token = info[0].As<Napi::Number>().Int32Value();

            return Napi::Boolean::New(info.Env(), llama_token_is_eog(model, token));
        }
        Napi::Value GetVocabularyType(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Model is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            auto vocabularyType = llama_vocab_type(model);

            return Napi::Number::From(info.Env(), int32_t(vocabularyType));
        }
        Napi::Value ShouldPrependBosToken(const Napi::CallbackInfo& info) {
            const int addBos = llama_add_bos_token(model);

            bool shouldPrependBos = addBos != -1 ? bool(addBos) : (llama_vocab_type(model) == LLAMA_VOCAB_TYPE_SPM);

            return Napi::Boolean::New(info.Env(), shouldPrependBos);
        }

        Napi::Value GetModelSize(const Napi::CallbackInfo& info) {
            return Napi::Number::From(info.Env(), llama_model_size(model));
        }

        static void init(Napi::Object exports) {
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
                        InstanceMethod("getTokenString", &AddonModel::GetTokenString),
                        InstanceMethod("getTokenAttributes", &AddonModel::GetTokenAttributes),
                        InstanceMethod("isEogToken", &AddonModel::IsEogToken),
                        InstanceMethod("getVocabularyType", &AddonModel::GetVocabularyType),
                        InstanceMethod("shouldPrependBosToken", &AddonModel::ShouldPrependBosToken),
                        InstanceMethod("getModelSize", &AddonModel::GetModelSize),
                        InstanceMethod("dispose", &AddonModel::Dispose),
                    }
                )
            );
        }
};

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
                model->model = llama_load_model_from_file(model->modelPath.c_str(), model->model_params);

                model->modelLoaded = model->model != nullptr && model->model != NULL;
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_load_model_from_file\"");
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
                llama_free_model(model->model);
                model->modelLoaded = false;

                model->dispose();
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_free_model\"");
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
        AddonModel* model;
        std::string loraFilePath;
        float loraScale;
        int32_t loraThreads;
        std::string baseModelPath;

        AddonModelLoadLoraWorker(
            const Napi::Env& env,
            AddonModel* model,
            std::string loraFilePath,
            float loraScale,
            int32_t loraThreads,
            std::string baseModelPath
        )
            : Napi::AsyncWorker(env, "AddonModelLoadLoraWorker"),
              model(model),
              loraFilePath(loraFilePath),
              loraScale(loraScale),
              loraThreads(loraThreads),
              baseModelPath(baseModelPath),
              deferred(Napi::Promise::Deferred::New(env)) {
            model->Ref();
        }
        ~AddonModelLoadLoraWorker() {
            model->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                const auto res = llama_model_apply_lora_from_file(
                    model->model,
                    loraFilePath.c_str(),
                    loraScale,
                    baseModelPath.empty() ? NULL : baseModelPath.c_str(),
                    loraThreads
                );

                if (res != 0) {
                    SetError(
                        std::string(
                            std::string("Failed to apply LoRA \"") + loraFilePath + std::string("\"") + (
                                baseModelPath.empty()
                                    ? std::string("")
                                    : (std::string(" with base model \"") + baseModelPath + std::string("\""))
                            )
                        )
                    );
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_model_apply_lora_from_file\"");
            }
        }
        void OnOK() {
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

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
    std::string loraFilePath = info[0].As<Napi::String>().Utf8Value();
    float scale = info[1].As<Napi::Number>().FloatValue();
    int32_t threads = info[2].As<Napi::Number>().Int32Value();
    std::string baseModelPath = (info.Length() > 3 && info[3].IsString()) ? info[3].As<Napi::String>().Utf8Value() : std::string("");

    int32_t resolvedThreads = threads == 0 ? std::thread::hardware_concurrency() : threads;

    AddonModelLoadLoraWorker* worker = new AddonModelLoadLoraWorker(this->Env(), this, loraFilePath, scale, threads, baseModelPath);
    worker->Queue();
    return worker->GetPromise();
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

class AddonGrammar : public Napi::ObjectWrap<AddonGrammar> {
    public:
        grammar_parser::parse_state parsed_grammar;
        Napi::Reference<Napi::Object> addonExportsRef;
        bool hasAddonExportsRef = false;

        AddonGrammar(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammar>(info) {
            // Get the model path
            std::string grammarCode = info[0].As<Napi::String>().Utf8Value();
            bool should_print_grammar = false;

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("addonExports")) {
                    addonExportsRef = Napi::Persistent(options.Get("addonExports").As<Napi::Object>());
                    hasAddonExportsRef = true;
                }

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

        ~AddonGrammar() {
            if (hasAddonExportsRef) {
                addonExportsRef.Unref();
                hasAddonExportsRef = false;
            }
        }

        static void init(Napi::Object exports) {
            exports.Set("AddonGrammar", DefineClass(exports.Env(), "AddonGrammar", {}));
        }
};

class AddonGrammarEvaluationState : public Napi::ObjectWrap<AddonGrammarEvaluationState> {
    public:
        AddonGrammar* grammarDef;
        llama_grammar* grammar = nullptr;

        AddonGrammarEvaluationState(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammarEvaluationState>(info) {
            grammarDef = Napi::ObjectWrap<AddonGrammar>::Unwrap(info[0].As<Napi::Object>());
            grammarDef->Ref();

            std::vector<const llama_grammar_element*> grammar_rules(grammarDef->parsed_grammar.c_rules());
            grammar = llama_grammar_init(grammar_rules.data(), grammar_rules.size(), grammarDef->parsed_grammar.symbol_ids.at("root"));
        }

        ~AddonGrammarEvaluationState() {
            grammarDef->Unref();

            if (grammar != nullptr) {
                llama_grammar_free(grammar);
                grammar = nullptr;
            }
        }

        static void init(Napi::Object exports) {
            exports.Set("AddonGrammarEvaluationState", DefineClass(exports.Env(), "AddonGrammarEvaluationState", {}));
        }
};

class AddonContext : public Napi::ObjectWrap<AddonContext> {
    public:
        AddonModel* model;
        llama_context_params context_params;
        llama_context* ctx;
        llama_batch batch;
        uint64_t batchMemorySize = 0;
        bool has_batch = false;
        int32_t batch_n_tokens = 0;
        int n_cur = 0;

        uint64_t loadedContextMemorySize = 0;
        bool contextLoaded = false;

        bool disposed = false;

        AddonContext(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonContext>(info) {
            model = Napi::ObjectWrap<AddonModel>::Unwrap(info[0].As<Napi::Object>());
            model->Ref();

            context_params = llama_context_default_params();
            context_params.seed = -1;
            context_params.n_ctx = 4096;
            context_params.n_threads = 6;
            context_params.n_threads_batch = context_params.n_threads;

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("noSeed")) {
                    context_params.seed = time(NULL);
                } else if (options.Has("seed")) {
                    context_params.seed = options.Get("seed").As<Napi::Number>().Uint32Value();
                }

                if (options.Has("contextSize")) {
                    context_params.n_ctx = options.Get("contextSize").As<Napi::Number>().Uint32Value();
                }

                if (options.Has("batchSize")) {
                    context_params.n_batch = options.Get("batchSize").As<Napi::Number>().Uint32Value();
                    context_params.n_ubatch = context_params.n_batch; // the batch queue is managed in the JS side, so there's no need for managing it on the C++ side
                }

                if (options.Has("sequences")) {
                    context_params.n_seq_max = options.Get("sequences").As<Napi::Number>().Uint32Value();
                }

                if (options.Has("embeddings")) {
                    context_params.embeddings = options.Get("embeddings").As<Napi::Boolean>().Value();
                }

                if (options.Has("flashAttention")) {
                    context_params.flash_attn = options.Get("flashAttention").As<Napi::Boolean>().Value();
                }

                if (options.Has("threads")) {
                    const auto n_threads = options.Get("threads").As<Napi::Number>().Uint32Value();
                    const auto resolved_n_threads = n_threads == 0 ? std::thread::hardware_concurrency() : n_threads;

                    context_params.n_threads = resolved_n_threads;
                    context_params.n_threads_batch = resolved_n_threads;
                }
            }
        }
        ~AddonContext() {
            dispose();
        }

        void dispose() {
            if (disposed) {
                return;
            }

            disposed = true;
            if (contextLoaded) {
                contextLoaded = false;
                llama_free(ctx);

                adjustNapiExternalMemorySubtract(Env(), loadedContextMemorySize);
                loadedContextMemorySize = 0;
            }

            model->Unref();

            disposeBatch();
        }
        void disposeBatch() {
            if (!has_batch) {
                return;
            }

            llama_batch_free(batch);
            has_batch = false;
            batch_n_tokens = 0;

            adjustNapiExternalMemorySubtract(Env(), batchMemorySize);
            batchMemorySize = 0;
        }

        Napi::Value Init(const Napi::CallbackInfo& info);
        Napi::Value Dispose(const Napi::CallbackInfo& info);

        Napi::Value GetContextSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_n_ctx(ctx));
        }
        Napi::Value InitBatch(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            if (has_batch) {
                llama_batch_free(batch);
            }

            int32_t n_tokens = info[0].As<Napi::Number>().Int32Value();

            batch = llama_batch_init(n_tokens, 0, 1);
            has_batch = true;
            batch_n_tokens = n_tokens;

            uint64_t newBatchMemorySize = calculateBatchMemorySize(n_tokens, llama_n_embd(model->model), context_params.n_batch);
            if (newBatchMemorySize > batchMemorySize) {
                adjustNapiExternalMemoryAdd(Env(), newBatchMemorySize - batchMemorySize);
                batchMemorySize = newBatchMemorySize;
            } else if (newBatchMemorySize < batchMemorySize) {
                adjustNapiExternalMemorySubtract(Env(), batchMemorySize - newBatchMemorySize);
                batchMemorySize = newBatchMemorySize;
            }

            return info.Env().Undefined();
        }
        Napi::Value DisposeBatch(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            disposeBatch();

            return info.Env().Undefined();
        }
        Napi::Value AddToBatch(const Napi::CallbackInfo& info) {
            if (!has_batch) {
                Napi::Error::New(info.Env(), "No batch is initialized").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
            int32_t firstTokenContextIndex = info[1].As<Napi::Number>().Int32Value();
            Napi::Uint32Array tokens = info[2].As<Napi::Uint32Array>();
            bool generateLogitAtTheEnd = info[3].As<Napi::Boolean>().Value();

            auto tokensLength = tokens.ElementLength();
            GGML_ASSERT(batch.n_tokens + tokensLength <= batch_n_tokens);

            for (size_t i = 0; i < tokensLength; i++) {
                llama_batch_add(batch, static_cast<llama_token>(tokens[i]), firstTokenContextIndex + i, { sequenceId }, false);
            }

            if (generateLogitAtTheEnd) {
                batch.logits[batch.n_tokens - 1] = true;

                auto logit_index = batch.n_tokens - 1;

                return Napi::Number::From(info.Env(), logit_index);
            }

            return info.Env().Undefined();
        }
        Napi::Value DisposeSequence(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();

            bool result = llama_kv_cache_seq_rm(ctx, sequenceId, -1, -1);

            if (!result) {
                Napi::Error::New(info.Env(), "Failed to dispose sequence").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return info.Env().Undefined();
        }
        Napi::Value RemoveTokenCellsFromSequence(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
            int32_t startPos = info[1].As<Napi::Number>().Int32Value();
            int32_t endPos = info[2].As<Napi::Number>().Int32Value();

            bool result = llama_kv_cache_seq_rm(ctx, sequenceId, startPos, endPos);

            return Napi::Boolean::New(info.Env(), result);
        }
        Napi::Value ShiftSequenceTokenCells(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
            int32_t startPos = info[1].As<Napi::Number>().Int32Value();
            int32_t endPos = info[2].As<Napi::Number>().Int32Value();
            int32_t shiftDelta = info[3].As<Napi::Number>().Int32Value();

            llama_kv_cache_seq_add(ctx, sequenceId, startPos, endPos, shiftDelta);

            return info.Env().Undefined();
        }
        Napi::Value DecodeBatch(const Napi::CallbackInfo& info);
        Napi::Value SampleToken(const Napi::CallbackInfo& info);

        Napi::Value AcceptGrammarEvaluationStateToken(const Napi::CallbackInfo& info) {
            AddonGrammarEvaluationState* grammar_evaluation_state =
                Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(info[0].As<Napi::Object>());
            llama_token tokenId = info[1].As<Napi::Number>().Int32Value();

            if ((grammar_evaluation_state)->grammar != nullptr) {
                llama_grammar_accept_token(ctx, (grammar_evaluation_state)->grammar, tokenId);
            }

            return info.Env().Undefined();
        }

        Napi::Value CanBeNextTokenForGrammarEvaluationState(const Napi::CallbackInfo& info) {
            AddonGrammarEvaluationState* grammar_evaluation_state =
                Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(info[0].As<Napi::Object>());
            llama_token tokenId = info[1].As<Napi::Number>().Int32Value();

            if ((grammar_evaluation_state)->grammar != nullptr) {
                std::vector<llama_token_data> candidates;
                candidates.reserve(1);
                candidates.emplace_back(llama_token_data { tokenId, 1, 0.0f });

                llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

                llama_sample_grammar(ctx, &candidates_p, (grammar_evaluation_state)->grammar);

                if (candidates_p.size == 0 || candidates_p.data[0].logit == -INFINITY) {
                    return Napi::Boolean::New(info.Env(), false);
                }

                return Napi::Boolean::New(info.Env(), true);
            }

            return Napi::Boolean::New(info.Env(), false);
        }

        Napi::Value GetEmbedding(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t inputTokensLength = info[0].As<Napi::Number>().Int32Value();

            if (inputTokensLength <= 0) {
                Napi::Error::New(info.Env(), "Invalid input tokens length").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            const int n_embd = llama_n_embd(model->model);
            const auto* embeddings = llama_get_embeddings_seq(ctx, 0);
            if (embeddings == NULL) {
                embeddings = llama_get_embeddings_ith(ctx, inputTokensLength - 1);

                if (embeddings == NULL) {
                    Napi::Error::New(info.Env(), std::string("Failed to get embeddings for token ") + std::to_string(inputTokensLength - 1)).ThrowAsJavaScriptException();
                    return info.Env().Undefined();
                }
            }

            Napi::Float64Array result = Napi::Float64Array::New(info.Env(), n_embd);
            for (size_t i = 0; i < n_embd; ++i) {
                result[i] = embeddings[i];
            }

            return result;
        }

        Napi::Value GetStateSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_state_get_size(ctx));
        }

        Napi::Value PrintTimings(const Napi::CallbackInfo& info) {
            llama_print_timings(ctx);
            llama_reset_timings(ctx);
            return info.Env().Undefined();
        }

        static void init(Napi::Object exports) {
            exports.Set(
                "AddonContext",
                DefineClass(
                    exports.Env(),
                    "AddonContext",
                    {
                        InstanceMethod("init", &AddonContext::Init),
                        InstanceMethod("getContextSize", &AddonContext::GetContextSize),
                        InstanceMethod("initBatch", &AddonContext::InitBatch),
                        InstanceMethod("addToBatch", &AddonContext::AddToBatch),
                        InstanceMethod("disposeSequence", &AddonContext::DisposeSequence),
                        InstanceMethod("removeTokenCellsFromSequence", &AddonContext::RemoveTokenCellsFromSequence),
                        InstanceMethod("shiftSequenceTokenCells", &AddonContext::ShiftSequenceTokenCells),
                        InstanceMethod("decodeBatch", &AddonContext::DecodeBatch),
                        InstanceMethod("sampleToken", &AddonContext::SampleToken),
                        InstanceMethod("acceptGrammarEvaluationStateToken", &AddonContext::AcceptGrammarEvaluationStateToken),
                        InstanceMethod("canBeNextTokenForGrammarEvaluationState", &AddonContext::CanBeNextTokenForGrammarEvaluationState),
                        InstanceMethod("getEmbedding", &AddonContext::GetEmbedding),
                        InstanceMethod("getStateSize", &AddonContext::GetStateSize),
                        InstanceMethod("printTimings", &AddonContext::PrintTimings),
                        InstanceMethod("dispose", &AddonContext::Dispose),
                    }
                )
            );
        }
};


class AddonContextDecodeBatchWorker : public Napi::AsyncWorker {
    public:
        AddonContext* ctx;

        AddonContextDecodeBatchWorker(const Napi::Env& env, AddonContext* ctx)
            : Napi::AsyncWorker(env, "AddonContextDecodeBatchWorker"),
              ctx(ctx),
              deferred(Napi::Promise::Deferred::New(env)) {
            ctx->Ref();
        }
        ~AddonContextDecodeBatchWorker() {
            ctx->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                // Perform the evaluation using llama_decode.
                int r = llama_decode(ctx->ctx, ctx->batch);

                if (r != 0) {
                    if (r == 1) {
                        SetError("could not find a KV slot for the batch (try reducing the size of the batch or increase the context)");
                    } else {
                        SetError("Eval has failed");
                    }

                    return;
                }

                llama_synchronize(ctx->ctx);
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_decode\"");
            }
        }
        void OnOK() {
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

Napi::Value AddonContext::DecodeBatch(const Napi::CallbackInfo& info) {
    AddonContextDecodeBatchWorker* worker = new AddonContextDecodeBatchWorker(info.Env(), this);
    worker->Queue();
    return worker->GetPromise();
}

class AddonContextLoadContextWorker : public Napi::AsyncWorker {
    public:
        AddonContext* context;

        AddonContextLoadContextWorker(const Napi::Env& env, AddonContext* context)
            : Napi::AsyncWorker(env, "AddonContextLoadContextWorker"),
              context(context),
              deferred(Napi::Promise::Deferred::New(env)) {
            context->Ref();
        }
        ~AddonContextLoadContextWorker() {
            context->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                context->ctx = llama_new_context_with_model(context->model->model, context->context_params);

                context->contextLoaded = context->ctx != nullptr && context->ctx != NULL;
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_new_context_with_model\"");
            }
        }
        void OnOK() {
            if (context->contextLoaded) {
                uint64_t contextMemorySize = llama_state_get_size(context->ctx);
                adjustNapiExternalMemoryAdd(Env(), contextMemorySize);
                context->loadedContextMemorySize = contextMemorySize;
            }

            deferred.Resolve(Napi::Boolean::New(Env(), context->contextLoaded));
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};
class AddonContextUnloadContextWorker : public Napi::AsyncWorker {
    public:
        AddonContext* context;

        AddonContextUnloadContextWorker(const Napi::Env& env, AddonContext* context)
            : Napi::AsyncWorker(env, "AddonContextUnloadContextWorker"),
              context(context),
              deferred(Napi::Promise::Deferred::New(env)) {
            context->Ref();
        }
        ~AddonContextUnloadContextWorker() {
            context->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                llama_free(context->ctx);
                context->contextLoaded = false;

                try {
                    if (context->has_batch) {
                        llama_batch_free(context->batch);
                        context->has_batch = false;
                        context->batch_n_tokens = 0;
                    }

                    context->dispose();
                } catch (const std::exception& e) {
                    SetError(e.what());
                } catch(...) {
                    SetError("Unknown error when calling \"llama_batch_free\"");
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_free\"");
            }
        }
        void OnOK() {
            adjustNapiExternalMemorySubtract(Env(), context->loadedContextMemorySize);
            context->loadedContextMemorySize = 0;

            adjustNapiExternalMemorySubtract(Env(), context->batchMemorySize);
            context->batchMemorySize = 0;

            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

Napi::Value AddonContext::Init(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    AddonContextLoadContextWorker* worker = new AddonContextLoadContextWorker(this->Env(), this);
    worker->Queue();
    return worker->GetPromise();
}
Napi::Value AddonContext::Dispose(const Napi::CallbackInfo& info) {
    if (disposed) {
        return info.Env().Undefined();
    }

    if (contextLoaded) {
        contextLoaded = false;

        AddonContextUnloadContextWorker* worker = new AddonContextUnloadContextWorker(this->Env(), this);
        worker->Queue();
        return worker->GetPromise();
    } else {
        dispose();

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(info.Env());
        deferred.Resolve(info.Env().Undefined());
        return deferred.Promise();
    }
}

class AddonContextSampleTokenWorker : public Napi::AsyncWorker {
    public:
        AddonContext* ctx;
        AddonGrammarEvaluationState* grammar_evaluation_state;
        int32_t batchLogitIndex;
        bool use_grammar = false;
        llama_token result;
        float temperature = 0.0f;
        float min_p = 0;
        int32_t top_k = 40;
        float top_p = 0.95f;
        float repeat_penalty = 1.10f;  // 1.0 = disabled
        float repeat_penalty_presence_penalty = 0.00f;  // 0.0 = disabled
        float repeat_penalty_frequency_penalty = 0.00f;  // 0.0 = disabled
        std::vector<llama_token> repeat_penalty_tokens;
        std::unordered_map<llama_token, float> tokenBiases;
        bool useTokenBiases = false;
        bool use_repeat_penalty = false;

        AddonContextSampleTokenWorker(const Napi::CallbackInfo& info, AddonContext* ctx)
            : Napi::AsyncWorker(info.Env(), "AddonContextSampleTokenWorker"),
              ctx(ctx),
              deferred(Napi::Promise::Deferred::New(info.Env())) {
            ctx->Ref();

            batchLogitIndex = info[0].As<Napi::Number>().Int32Value();

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("temperature")) {
                    temperature = options.Get("temperature").As<Napi::Number>().FloatValue();
                }

                if (options.Has("minP")) {
                    min_p = options.Get("minP").As<Napi::Number>().FloatValue();
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

                if (options.Has("tokenBiasKeys") && options.Has("tokenBiasValues")) {
                    Napi::Uint32Array tokenBiasKeys = options.Get("tokenBiasKeys").As<Napi::Uint32Array>();
                    Napi::Float32Array tokenBiasValues = options.Get("tokenBiasValues").As<Napi::Float32Array>();

                    if (tokenBiasKeys.ElementLength() == tokenBiasValues.ElementLength()) {
                        for (size_t i = 0; i < tokenBiasKeys.ElementLength(); i++) {
                            tokenBiases[static_cast<llama_token>(tokenBiasKeys[i])] = tokenBiasValues[i];
                        }

                        useTokenBiases = true;
                    }
                }

                if (options.Has("repeatPenaltyPresencePenalty")) {
                    repeat_penalty_presence_penalty = options.Get("repeatPenaltyPresencePenalty").As<Napi::Number>().FloatValue();
                }

                if (options.Has("repeatPenaltyFrequencyPenalty")) {
                    repeat_penalty_frequency_penalty = options.Get("repeatPenaltyFrequencyPenalty").As<Napi::Number>().FloatValue();
                }

                if (options.Has("grammarEvaluationState")) {
                    grammar_evaluation_state =
                        Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(options.Get("grammarEvaluationState").As<Napi::Object>());
                    grammar_evaluation_state->Ref();
                    use_grammar = true;
                }
            }
        }
        ~AddonContextSampleTokenWorker() {
            ctx->Unref();

            if (use_grammar) {
                grammar_evaluation_state->Unref();
                use_grammar = false;
            }
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                SampleToken();
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"SampleToken\"");
            }
        }

        void SampleToken() {
            llama_token new_token_id = 0;

            // Select the best prediction.
            if (llama_get_logits(ctx->ctx) == nullptr) {
                SetError("This model does not support token generation");
                return;
            }

            auto logits = llama_get_logits_ith(ctx->ctx, batchLogitIndex);
            auto n_vocab = llama_n_vocab(ctx->model->model);

            std::vector<llama_token_data> candidates;
            candidates.reserve(n_vocab);

            for (llama_token token_id = 0; token_id < n_vocab; token_id++) {
                auto logit = logits[token_id];

                if (useTokenBiases) {
                    bool hasTokenBias = tokenBiases.find(token_id) != tokenBiases.end();
                    if (hasTokenBias) {
                        auto logitBias = tokenBiases.at(token_id);
                        if (logitBias == -INFINITY || logitBias < -INFINITY) {
                            if (!llama_token_is_eog(ctx->model->model, token_id)) {
                                logit = -INFINITY;
                            }
                        } else {
                            logit += logitBias;
                        }
                    }
                }

                candidates.emplace_back(llama_token_data { token_id, logit, 0.0f });
            }

            llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

            if (use_repeat_penalty && !repeat_penalty_tokens.empty()) {
                llama_sample_repetition_penalties(
                    ctx->ctx,
                    &candidates_p,
                    repeat_penalty_tokens.data(),
                    repeat_penalty_tokens.size(),
                    repeat_penalty,
                    repeat_penalty_frequency_penalty,
                    repeat_penalty_presence_penalty
                );
            }

            if (use_grammar && (grammar_evaluation_state)->grammar != nullptr) {
                llama_sample_grammar(ctx->ctx, &candidates_p, (grammar_evaluation_state)->grammar);

                if ((candidates_p.size == 0 || candidates_p.data[0].logit == -INFINITY) && useTokenBiases) {
                    // logit biases caused grammar sampling to fail, so sampling again without logit biases
                    useTokenBiases = false;
                    SampleToken();
                    return;
                }
            }

            if (temperature <= 0) {
                new_token_id = llama_sample_token_greedy(ctx->ctx, &candidates_p);
            } else {
                const int32_t resolved_top_k =
                    top_k <= 0 ? llama_n_vocab(ctx->model->model) : std::min(top_k, llama_n_vocab(ctx->model->model));
                const int32_t n_probs = 0;  // Number of probabilities to keep - 0 = disabled
                const float tfs_z = 1.00f;  // Tail free sampling - 1.0 = disabled
                const float typical_p = 1.00f;  // Typical probability - 1.0 = disabled
                const float resolved_top_p = top_p;  // Top p sampling - 1.0 = disabled

                // Temperature sampling
                size_t min_keep = std::max(1, n_probs);
                llama_sample_top_k(ctx->ctx, &candidates_p, resolved_top_k, min_keep);
                llama_sample_tail_free(ctx->ctx, &candidates_p, tfs_z, min_keep);
                llama_sample_typical(ctx->ctx, &candidates_p, typical_p, min_keep);
                llama_sample_top_p(ctx->ctx, &candidates_p, resolved_top_p, min_keep);
                llama_sample_min_p(ctx->ctx, &candidates_p, min_p, min_keep);
                llama_sample_temp(ctx->ctx, &candidates_p, temperature);
                new_token_id = llama_sample_token(ctx->ctx, &candidates_p);
            }

            if (!llama_token_is_eog(ctx->model->model, new_token_id) && use_grammar && (grammar_evaluation_state)->grammar != nullptr) {
                llama_grammar_accept_token(ctx->ctx, (grammar_evaluation_state)->grammar, new_token_id);
            }

            result = new_token_id;
        }
        void OnOK() {
            Napi::Number resultValue = Napi::Number::New(Env(), static_cast<uint32_t>(result));
            deferred.Resolve(resultValue);
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

Napi::Value AddonContext::SampleToken(const Napi::CallbackInfo& info) {
    AddonContextSampleTokenWorker* worker = new AddonContextSampleTokenWorker(info, this);
    worker->Queue();
    return worker->GetPromise();
}

Napi::Value systemInfo(const Napi::CallbackInfo& info) {
    return Napi::String::From(info.Env(), llama_print_system_info());
}

Napi::Value addonGetSupportsGpuOffloading(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), llama_supports_gpu_offload());
}

Napi::Value addonGetSupportsMmap(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), llama_supports_mmap());
}

Napi::Value addonGetSupportsMlock(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), llama_supports_mlock());
}

Napi::Value addonGetBlockSizeForGgmlType(const Napi::CallbackInfo& info) {
    const int ggmlType = info[0].As<Napi::Number>().Int32Value();

    if (ggmlType < 0 || ggmlType > GGML_TYPE_COUNT) {
        return info.Env().Undefined();
    }

    const auto blockSize = ggml_blck_size(static_cast<ggml_type>(ggmlType));

    return Napi::Number::New(info.Env(), blockSize);
}

Napi::Value addonGetTypeSizeForGgmlType(const Napi::CallbackInfo& info) {
    const int ggmlType = info[0].As<Napi::Number>().Int32Value();

    if (ggmlType < 0 || ggmlType > GGML_TYPE_COUNT) {
        return info.Env().Undefined();
    }

    const auto typeSize = ggml_type_size(static_cast<ggml_type>(ggmlType));

    return Napi::Number::New(info.Env(), typeSize);
}

Napi::Value addonGetConsts(const Napi::CallbackInfo& info) {
    Napi::Object consts = Napi::Object::New(info.Env());
    consts.Set("ggmlMaxDims", Napi::Number::New(info.Env(), GGML_MAX_DIMS));
    consts.Set("ggmlTypeF16Size", Napi::Number::New(info.Env(), ggml_type_size(GGML_TYPE_F16)));
    consts.Set("ggmlTypeF32Size", Napi::Number::New(info.Env(), ggml_type_size(GGML_TYPE_F32)));
    consts.Set("ggmlTensorOverhead", Napi::Number::New(info.Env(), ggml_tensor_overhead()));
    consts.Set("llamaMaxRngState", Napi::Number::New(info.Env(), LLAMA_MAX_RNG_STATE));
    consts.Set("llamaPosSize", Napi::Number::New(info.Env(), sizeof(llama_pos)));
    consts.Set("llamaSeqIdSize", Napi::Number::New(info.Env(), sizeof(llama_seq_id)));

    return consts;
}

int addonGetGgmlLogLevelNumber(ggml_log_level level) {
    switch (level) {
        case GGML_LOG_LEVEL_ERROR: return 2;
        case GGML_LOG_LEVEL_WARN: return 3;
        case GGML_LOG_LEVEL_INFO: return 4;
        case GGML_LOG_LEVEL_DEBUG: return 5;
    }

    return 1;
}

void addonCallJsLogCallback(
    Napi::Env env, Napi::Function callback, AddonThreadSafeLogCallbackFunctionContext* context, addon_logger_log* data
) {
    bool called = false;

    if (env != nullptr && callback != nullptr && addonJsLoggerCallbackSet) {
        try {
            callback.Call({
                Napi::Number::New(env, data->logLevelNumber),
                Napi::String::New(env, data->stringStream->str()),
            });
            called = true;
        } catch (const Napi::Error& e) {
            called = false;
        }
    }

    if (!called && data != nullptr) {
        if (data->logLevelNumber == 2) {
            fputs(data->stringStream->str().c_str(), stderr);
            fflush(stderr);
        } else {
            fputs(data->stringStream->str().c_str(), stdout);
            fflush(stdout);
        }
    }

    if (data != nullptr) {
        delete data->stringStream;
        delete data;
    }
}

static void addonLlamaCppLogCallback(ggml_log_level level, const char* text, void* user_data) {
    int logLevelNumber = addonGetGgmlLogLevelNumber(level);

    if (logLevelNumber > addonLoggerLogLevel) {
        return;
    }

    if (addonJsLoggerCallbackSet) {
        std::stringstream* stringStream = new std::stringstream();
        if (text != nullptr) {
            *stringStream << text;
        }

        addon_logger_log* data = new addon_logger_log {
            logLevelNumber,
            stringStream,
        };

        auto status = addonThreadSafeLoggerCallback.NonBlockingCall(data);

        if (status == napi_ok) {
            return;
        } else {
            delete stringStream;
            delete data;
        }
    }

    if (text != nullptr) {
        if (level == 2) {
            fputs(text, stderr);
            fflush(stderr);
        } else {
            fputs(text, stdout);
            fflush(stdout);
        }
    }
}

Napi::Value setLogger(const Napi::CallbackInfo& info) {
    if (info.Length() < 1 || !info[0].IsFunction()) {
        if (addonJsLoggerCallbackSet) {
            addonJsLoggerCallbackSet = false;
            addonThreadSafeLoggerCallback.Release();
        }

        return info.Env().Undefined();
    }

    auto addonLoggerJSCallback = info[0].As<Napi::Function>();
    AddonThreadSafeLogCallbackFunctionContext* context = new Napi::Reference<Napi::Value>(Napi::Persistent(info.This()));
    addonThreadSafeLoggerCallback = AddonThreadSafeLogCallbackFunction::New(
        info.Env(),
        addonLoggerJSCallback,
        "loggerCallback",
        0,
        1,
        context,
        [](Napi::Env, void*, AddonThreadSafeLogCallbackFunctionContext* ctx) {
            addonJsLoggerCallbackSet = false;

            delete ctx;
        }
    );
    addonJsLoggerCallbackSet = true;

    // prevent blocking the main node process from exiting due to active resources
    addonThreadSafeLoggerCallback.Unref(info.Env());

    return info.Env().Undefined();
}

Napi::Value setLoggerLogLevel(const Napi::CallbackInfo& info) {
    if (info.Length() < 1 || !info[0].IsNumber()) {
        addonLoggerLogLevel = 5;

        return info.Env().Undefined();
    }

    addonLoggerLogLevel = info[0].As<Napi::Number>().Int32Value();

    return info.Env().Undefined();
}

class AddonBackendLoadWorker : public Napi::AsyncWorker {
    public:
        AddonBackendLoadWorker(const Napi::Env& env)
            : Napi::AsyncWorker(env, "AddonBackendLoadWorker"),
              deferred(Napi::Promise::Deferred::New(env)) {
        }
        ~AddonBackendLoadWorker() {
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                llama_backend_init();

                try {
                    if (backendDisposed) {
                        llama_backend_free();
                    } else {
                        backendInitialized = true;
                    }
                } catch (const std::exception& e) {
                    SetError(e.what());
                } catch(...) {
                    SetError("Unknown error when calling \"llama_backend_free\"");
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_backend_init\"");
            }
        }
        void OnOK() {
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};


class AddonBackendUnloadWorker : public Napi::AsyncWorker {
    public:
        AddonBackendUnloadWorker(const Napi::Env& env)
            : Napi::AsyncWorker(env, "AddonBackendUnloadWorker"),
              deferred(Napi::Promise::Deferred::New(env)) {
        }
        ~AddonBackendUnloadWorker() {
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                if (backendInitialized) {
                    backendInitialized = false;
                    llama_backend_free();
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_backend_free\"");
            }
        }
        void OnOK() {
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

Napi::Value addonInit(const Napi::CallbackInfo& info) {
    if (backendInitialized) {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(info.Env());
        deferred.Resolve(info.Env().Undefined());
        return deferred.Promise();
    }

    AddonBackendLoadWorker* worker = new AddonBackendLoadWorker(info.Env());
    worker->Queue();
    return worker->GetPromise();
}

Napi::Value addonDispose(const Napi::CallbackInfo& info) {
    if (backendDisposed) {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(info.Env());
        deferred.Resolve(info.Env().Undefined());
        return deferred.Promise();
    }

    backendDisposed = true;

    AddonBackendUnloadWorker* worker = new AddonBackendUnloadWorker(info.Env());
    worker->Queue();
    return worker->GetPromise();
}

static void addonFreeLlamaBackend(Napi::Env env, int* data) {
    if (backendDisposed) {
        return;
    }

    backendDisposed = true;
    if (backendInitialized) {
        backendInitialized = false;
        llama_backend_free();
    }
}

Napi::Object registerCallback(Napi::Env env, Napi::Object exports) {
    exports.DefineProperties({
        Napi::PropertyDescriptor::Function("systemInfo", systemInfo),
        Napi::PropertyDescriptor::Function("getSupportsGpuOffloading", addonGetSupportsGpuOffloading),
        Napi::PropertyDescriptor::Function("getSupportsMmap", addonGetSupportsMmap),
        Napi::PropertyDescriptor::Function("getSupportsMlock", addonGetSupportsMlock),
        Napi::PropertyDescriptor::Function("getBlockSizeForGgmlType", addonGetBlockSizeForGgmlType),
        Napi::PropertyDescriptor::Function("getTypeSizeForGgmlType", addonGetTypeSizeForGgmlType),
        Napi::PropertyDescriptor::Function("getConsts", addonGetConsts),
        Napi::PropertyDescriptor::Function("setLogger", setLogger),
        Napi::PropertyDescriptor::Function("setLoggerLogLevel", setLoggerLogLevel),
        Napi::PropertyDescriptor::Function("getGpuVramInfo", getGpuVramInfo),
        Napi::PropertyDescriptor::Function("getGpuDeviceInfo", getGpuDeviceInfo),
        Napi::PropertyDescriptor::Function("getGpuType", getGpuType),
        Napi::PropertyDescriptor::Function("init", addonInit),
        Napi::PropertyDescriptor::Function("dispose", addonDispose),
    });
    AddonModel::init(exports);
    AddonGrammar::init(exports);
    AddonGrammarEvaluationState::init(exports);
    AddonContext::init(exports);

    llama_log_set(addonLlamaCppLogCallback, nullptr);

    exports.AddFinalizer(addonFreeLlamaBackend, static_cast<int*>(nullptr));

    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, registerCallback)
