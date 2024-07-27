#pragma once
#include "napi.h"

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

