#include "addonGlobals.h"
#include "AddonModel.h"
#include "AddonModelData.h"
#include "AddonModelLora.h"

class AddonModelLoraUnloadLoraWorker : public Napi::AsyncWorker {
    public:
        AddonModelLora* addonLora;

        AddonModelLoraUnloadLoraWorker(const Napi::Env& env, AddonModelLora* addonLora)
            : Napi::AsyncWorker(env, "AddonModelLoraUnloadLoraWorker"),
              addonLora(addonLora),
              deferred(Napi::Promise::Deferred::New(env)) {
            addonLora->Ref();
        }
        ~AddonModelLoraUnloadLoraWorker() {
            addonLora->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                addonLora->disposeMemory();
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_adapter_lora_free\"");
            }
        }
        void OnOK() {
            addonLora->disposeMT();
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

AddonModelLora::AddonModelLora(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonModelLora>(info) {
    model = Napi::ObjectWrap<AddonModel>::Unwrap(info[0].As<Napi::Object>());
    loraFilePath = info[1].As<Napi::String>().Utf8Value();
    lora_adapter = nullptr;
}

AddonModelLora::~AddonModelLora() {
    disposeMT();
}

void AddonModelLora::disposeMemory() {
    std::lock_guard<std::mutex> lock(disposeMutex);

    if (memoryDisposed) {
        return;
    }

    memoryDisposed = true;

    if (lora_adapter != nullptr) {
        llama_adapter_lora_free(lora_adapter);
        lora_adapter = nullptr;
    }
}

void AddonModelLora::disposeMT(bool skipErase) {
    bool shouldRemoveFromModel = false;
    bool shouldUnrefModel = false;
    bool shouldUnrefSelf = false;

    disposeMemory();

    {
        std::lock_guard<std::mutex> lock(disposeMutex);

        if (disposed) {
            return;
        }

        disposed = true;
        shouldRemoveFromModel = !skipErase;
        shouldUnrefModel = hasModelRef;
        shouldUnrefSelf = hasSelfRef;
        hasModelRef = false;
        hasSelfRef = false;
    }

    if (shouldRemoveFromModel && model->data != nullptr) {
        model->data->removeLora(this);
    }

    if (shouldUnrefModel) {
        model->Unref();
    }
    if (shouldUnrefSelf) {
        Unref();
    }
}

Napi::Value AddonModelLora::GetFilePath(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), loraFilePath);
}


Napi::Value AddonModelLora::GetUsages(const Napi::CallbackInfo& info) {
    return Napi::Number::From(info.Env(), usages);
}

void AddonModelLora::SetUsages(const Napi::CallbackInfo& info, const Napi::Value &value) {
    usages = value.As<Napi::Number>().Uint32Value();
}

Napi::Value AddonModelLora::Dispose(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(info.Env());
        deferred.Resolve(info.Env().Undefined());
        return deferred.Promise();
    }

    if (lora_adapter == nullptr) {
        disposeMT();

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(info.Env());
        deferred.Resolve(info.Env().Undefined());
        return deferred.Promise();
    }

    AddonModelLoraUnloadLoraWorker* worker = new AddonModelLoraUnloadLoraWorker(this->Env(), this);
    worker->Queue();
    return worker->GetPromise();
}

Napi::Value AddonModelLora::GetDisposed(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), disposed);
}

void AddonModelLora::init(Napi::Object exports) {
    exports.Set(
        "AddonModelLora",
        DefineClass(
            exports.Env(),
            "AddonModelLora",
            {
                InstanceAccessor("usages", &AddonModelLora::GetUsages, &AddonModelLora::SetUsages),
                InstanceAccessor("filePath", &AddonModelLora::GetFilePath, nullptr),
                InstanceAccessor("disposed", &AddonModelLora::GetDisposed, nullptr),
                InstanceMethod("dispose", &AddonModelLora::Dispose),
            }
        )
    );
}
