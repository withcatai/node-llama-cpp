#pragma once
#include "napi.h"

Napi::Value getGpuVramInfo(const Napi::CallbackInfo& info);
Napi::Value getGpuDeviceInfo(const Napi::CallbackInfo& info);
Napi::Value getGpuType(const Napi::CallbackInfo& info);