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
                addonLora->dispose();
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_adapter_lora_free\"");
            }
        }
        void OnOK() {
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
    dispose();
}

void AddonModelLora::dispose(bool skipErase) {
    if (lora_adapter != nullptr) {
        auto loraAdapterToDispose = lora_adapter;
        lora_adapter = nullptr;
        llama_adapter_lora_free(loraAdapterToDispose);
        
        if (!skipErase && model->data != nullptr) {
            model->data->removeLora(this);
        }

        model->Unref();
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
    AddonModelLoraUnloadLoraWorker* worker = new AddonModelLoraUnloadLoraWorker(this->Env(), this);
    worker->Queue();
    return worker->GetPromise();
}

Napi::Value AddonModelLora::GetDisposed(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), lora_adapter == nullptr);
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
