#include "addonLog.h"

#include <atomic>
#include <optional>
#include <sstream>

AddonThreadSafeLogCallbackFunction addonThreadSafeLoggerCallback;
bool addonJsLoggerCallbackSet = false;
std::atomic<int> addonLoggerLogLevel(5);
std::atomic<std::optional<int>> addonLoggerLogLevelOverride(std::nullopt);
std::atomic<int> addonLastLoggerLogLevel(6);

static int addonGetGgmlLogLevelNumber(ggml_log_level level) {
    switch (level) {
        case GGML_LOG_LEVEL_ERROR: return 2;
        case GGML_LOG_LEVEL_WARN: return 3;
        case GGML_LOG_LEVEL_INFO: return 4;
        case GGML_LOG_LEVEL_NONE: return 5;
        case GGML_LOG_LEVEL_DEBUG: return 6;
        case GGML_LOG_LEVEL_CONT: return addonLastLoggerLogLevel.load(std::memory_order_relaxed);
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

    if (level != GGML_LOG_LEVEL_CONT) {
        addonLastLoggerLogLevel.store(logLevelNumber, std::memory_order_relaxed);
    }

    auto overrideLogLevel = addonLoggerLogLevelOverride.load(std::memory_order_relaxed);
    if (overrideLogLevel.has_value() && logLevelNumber > overrideLogLevel.value()) {
        return;
    } else if (logLevelNumber > addonLoggerLogLevel.load(std::memory_order_relaxed)) {
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
    if (addonJsLoggerCallbackSet) {
        addonJsLoggerCallbackSet = false;
        addonThreadSafeLoggerCallback.Release();
    }

    if (info.Length() < 1 || !info[0].IsFunction()) {
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
        addonLoggerLogLevel.store(5, std::memory_order_relaxed);

        return info.Env().Undefined();
    }

    addonLoggerLogLevel.store(info[0].As<Napi::Number>().Int32Value(), std::memory_order_relaxed);

    return info.Env().Undefined();
}

Napi::Value setLoggerLogLevelOverride(const Napi::CallbackInfo& info) {
    if (info.Length() < 1 || !info[0].IsNumber() || info[0].IsUndefined()) {
        addonLoggerLogLevelOverride.store(std::nullopt, std::memory_order_relaxed);

        return info.Env().Undefined();
    }

    addonLoggerLogLevelOverride.store(info[0].As<Napi::Number>().Int32Value(), std::memory_order_relaxed);

    return info.Env().Undefined();
}

void addonLog(ggml_log_level level, const std::string text) {
    addonLlamaCppLogCallback(level, std::string("[addon] " + text + "\n").c_str(), nullptr);
}
