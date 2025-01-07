#pragma once
#include <utility>
#include <string>
#include "napi.h"
#include "llama.h"

Napi::Value getGpuVramInfo(const Napi::CallbackInfo& info);
Napi::Value getGpuDeviceInfo(const Napi::CallbackInfo& info);
std::pair<ggml_backend_dev_t, std::string> getGpuDevice();
Napi::Value getGpuType(const Napi::CallbackInfo& info);
Napi::Value ensureGpuDeviceIsSupported(const Napi::CallbackInfo& info);
