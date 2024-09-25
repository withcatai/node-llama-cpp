#include <sstream>

#include "addonLog.h"

AddonThreadSafeLogCallbackFunction addonThreadSafeLoggerCallback;
bool addonJsLoggerCallbackSet = false;
int addonLoggerLogLevel = 5;
int addonLastLoggerLogLevel = 6;

static int addonGetGgmlLogLevelNumber(ggml_log_level level) {
    switch (level) {
        case GGML_LOG_LEVEL_ERROR: return 2;
        case GGML_LOG_LEVEL_WARN: return 3;
        case GGML_LOG_LEVEL_INFO: return 4;
        case GGML_LOG_LEVEL_NONE: return 5;
        case GGML_LOG_LEVEL_DEBUG: return 6;
        case GGML_LOG_LEVEL_CONT: return addonLastLoggerLogLevel;
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

void addonLlamaCppLogCallback(ggml_log_level level, const char* text, void* user_data) {
    int logLevelNumber = addonGetGgmlLogLevelNumber(level);
    addonLastLoggerLogLevel = logLevelNumber;

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
