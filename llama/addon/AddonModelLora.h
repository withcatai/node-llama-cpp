#pragma once
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"

class AddonModelLora : public Napi::ObjectWrap<AddonModelLora> {
    public:
        AddonModel* model;
        llama_lora_adapter * lora_adapter;
        std::string loraFilePath;
        uint32_t usages;

        AddonModelLora(const Napi::CallbackInfo& info);
        ~AddonModelLora();

        void dispose(bool skipErase = false);

        Napi::Value GetFilePath(const Napi::CallbackInfo& info);

        Napi::Value GetUsages(const Napi::CallbackInfo& info);
        void SetUsages(const Napi::CallbackInfo& info, const Napi::Value &value);

        Napi::Value GetDisposed(const Napi::CallbackInfo& info);

        Napi::Value Dispose(const Napi::CallbackInfo& info);

        static void init(Napi::Object exports);
};