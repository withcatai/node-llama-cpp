#include "getGpuInfo.h"
#include "addonLog.h"

#ifdef GPU_INFO_USE_CUDA
#  include "../../gpuInfo/cuda-gpu-info.h"
#endif
#ifdef GPU_INFO_USE_VULKAN
#  include "../../gpuInfo/vulkan-gpu-info.h"
#endif
#ifdef GPU_INFO_USE_METAL
#  include "../../gpuInfo/metal-gpu-info.h"
#endif


#ifdef GPU_INFO_USE_CUDA
void logCudaError(const char* message) {
    addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, (std::string("CUDA error: ") + std::string(message)).c_str(), nullptr);
}
#endif
#ifdef GPU_INFO_USE_VULKAN
void logVulkanWarning(const char* message) {
    addonLlamaCppLogCallback(GGML_LOG_LEVEL_WARN, (std::string("Vulkan warning: ") + std::string(message)).c_str(), nullptr);
}
#endif

Napi::Value getGpuVramInfo(const Napi::CallbackInfo& info) {
    uint64_t total = 0;
    uint64_t used = 0;

#ifdef GPU_INFO_USE_CUDA
    size_t cudaDeviceTotal = 0;
    size_t cudaDeviceUsed = 0;
    bool cudeGetInfoSuccess = gpuInfoGetTotalCudaDevicesInfo(&cudaDeviceTotal, &cudaDeviceUsed, logCudaError);

    if (cudeGetInfoSuccess) {
        total += cudaDeviceTotal;
        used += cudaDeviceUsed;
    }
#endif

#ifdef GPU_INFO_USE_VULKAN
    uint64_t vulkanDeviceTotal = 0;
    uint64_t vulkanDeviceUsed = 0;
    const bool vulkanDeviceSupportsMemoryBudgetExtension = gpuInfoGetTotalVulkanDevicesInfo(&vulkanDeviceTotal, &vulkanDeviceUsed, logVulkanWarning);

    if (vulkanDeviceSupportsMemoryBudgetExtension) {
        total += vulkanDeviceTotal;
        used += vulkanDeviceUsed;
    }
#endif

#ifdef GPU_INFO_USE_METAL
    uint64_t metalDeviceTotal = 0;
    uint64_t metalDeviceUsed = 0;
    getMetalGpuInfo(&metalDeviceTotal, &metalDeviceUsed);

    total += metalDeviceTotal;
    used += metalDeviceUsed;
#endif

    Napi::Object result = Napi::Object::New(info.Env());
    result.Set("total", Napi::Number::From(info.Env(), total));
    result.Set("used", Napi::Number::From(info.Env(), used));

    return result;
}

Napi::Value getGpuDeviceInfo(const Napi::CallbackInfo& info) {
    std::vector<std::string> deviceNames;

#ifdef GPU_INFO_USE_CUDA
    gpuInfoGetCudaDeviceNames(&deviceNames, logCudaError);
#endif

#ifdef GPU_INFO_USE_VULKAN
    gpuInfoGetVulkanDeviceNames(&deviceNames, logVulkanWarning);
#endif

#ifdef GPU_INFO_USE_METAL
    getMetalGpuDeviceNames(&deviceNames);
#endif

    Napi::Object result = Napi::Object::New(info.Env());

    Napi::Array deviceNamesNapiArray = Napi::Array::New(info.Env(), deviceNames.size());
    for (size_t i = 0; i < deviceNames.size(); ++i) {
        deviceNamesNapiArray[i] = Napi::String::New(info.Env(), deviceNames[i]);
    }
    result.Set("deviceNames", deviceNamesNapiArray);

    return result;
}

Napi::Value getGpuType(const Napi::CallbackInfo& info) {
#ifdef GPU_INFO_USE_CUDA
    return Napi::String::New(info.Env(), "cuda");
#endif

#ifdef GPU_INFO_USE_VULKAN
    return Napi::String::New(info.Env(), "vulkan");
#endif

#ifdef GPU_INFO_USE_METAL
    return Napi::String::New(info.Env(), "metal");
#endif

    return info.Env().Undefined();
}