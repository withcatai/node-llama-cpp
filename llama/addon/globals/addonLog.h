#pragma once
#include "llama.h"
#include "napi.h"


struct addon_logger_log {
    public:
        const int logLevelNumber;
        const std::stringstream* stringStream;
};

void addonLlamaCppLogCallback(ggml_log_level level, const char* text, void* user_data);

using AddonThreadSafeLogCallbackFunctionContext = Napi::Reference<Napi::Value>;
void addonCallJsLogCallback(
    Napi::Env env, Napi::Function callback, AddonThreadSafeLogCallbackFunctionContext* context, addon_logger_log* data
);
using AddonThreadSafeLogCallbackFunction =
    Napi::TypedThreadSafeFunction<AddonThreadSafeLogCallbackFunctionContext, addon_logger_log, addonCallJsLogCallback>;

Napi::Value setLogger(const Napi::CallbackInfo& info);
Napi::Value setLoggerLogLevel(const Napi::CallbackInfo& info);
