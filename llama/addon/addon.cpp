#include "addonGlobals.h"
#include "AddonModel.h"
#include "AddonModelLora.h"
#include "AddonGrammar.h"
#include "AddonGrammarEvaluationState.h"
#include "AddonSampler.h"
#include "AddonContext.h"
#include "globals/addonLog.h"
#include "globals/addonProgress.h"
#include "globals/getGpuInfo.h"

bool backendInitialized = false;
bool backendDisposed = false;

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

Napi::Value addonGetMathCores(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), cpu_get_num_math());
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
    consts.Set("llamaPosSize", Napi::Number::New(info.Env(), sizeof(llama_pos)));
    consts.Set("llamaSeqIdSize", Napi::Number::New(info.Env(), sizeof(llama_seq_id)));

    return consts;
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
        Napi::PropertyDescriptor::Function("getMathCores", addonGetMathCores),
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
    AddonModelLora::init(exports);
    AddonGrammar::init(exports);
    AddonGrammarEvaluationState::init(exports);
    AddonContext::init(exports);
    AddonSampler::init(exports);

    llama_log_set(addonLlamaCppLogCallback, nullptr);

    exports.AddFinalizer(addonFreeLlamaBackend, static_cast<int*>(nullptr));

    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, registerCallback)
