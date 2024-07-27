#include "addonProgress.h"

void addonCallJsProgressCallback(
    Napi::Env env, Napi::Function callback, AddonThreadSafeProgressCallbackFunctionContext* context, addon_progress_event* data
) {
    if (env != nullptr && callback != nullptr) {
        try {
            callback.Call({Napi::Number::New(env, data->progress)});
        } catch (const Napi::Error& e) {}
    }

    if (data != nullptr) {
        delete data;
    }
}
