#include "getGpuInfo.h"
#include "addonLog.h"

#ifdef __APPLE__
    #include <TargetConditionals.h>
#endif

#ifdef GPU_INFO_USE_VULKAN
#  include "../../gpuInfo/vulkan-gpu-info.h"
#endif


#ifdef GPU_INFO_USE_VULKAN
void logVulkanWarning(const char* message) {
    addonLlamaCppLogCallback(GGML_LOG_LEVEL_WARN, (std::string("Vulkan warning: ") + std::string(message)).c_str(), nullptr);
}
#endif

Napi::Value getGpuVramInfo(const Napi::CallbackInfo& info) {
    ggml_backend_dev_t device = NULL;
    size_t deviceTotal = 0;
    size_t deviceFree = 0;

    uint64_t total = 0;
    uint64_t used = 0;
    uint64_t unifiedVramSize = 0;

    for (size_t i = 0; i < ggml_backend_dev_count(); i++) {
        device = ggml_backend_dev_get(i);
        if (ggml_backend_dev_type(device) == GGML_BACKEND_DEVICE_TYPE_GPU) {
            deviceTotal = 0;
            deviceFree = 0;
            ggml_backend_dev_memory(device, &deviceFree, &deviceTotal);

            total += deviceTotal;
            used += deviceTotal - deviceFree;

#if defined(__arm64__) || defined(__aarch64__)
            if (std::string(ggml_backend_dev_name(device)) == "Metal") {
                unifiedVramSize += deviceTotal;
            }
#endif
        }
    }

#ifdef GPU_INFO_USE_VULKAN
    uint64_t vulkanDeviceTotal = 0;
    uint64_t vulkanDeviceUsed = 0;
    uint64_t vulkanDeviceUnifiedVramSize = 0;
    const bool vulkanDeviceSupportsMemoryBudgetExtension = gpuInfoGetTotalVulkanDevicesInfo(&vulkanDeviceTotal, &vulkanDeviceUsed, &vulkanDeviceUnifiedVramSize, logVulkanWarning);

    if (vulkanDeviceSupportsMemoryBudgetExtension) {
        if (vulkanDeviceUnifiedVramSize > total) {
            // this means that we counted memory from devices that aren't used by llama.cpp
            vulkanDeviceUnifiedVramSize = 0;
        }
        
        unifiedVramSize += vulkanDeviceUnifiedVramSize;
    }
#endif

    Napi::Object result = Napi::Object::New(info.Env());
    result.Set("total", Napi::Number::From(info.Env(), total));
    result.Set("used", Napi::Number::From(info.Env(), used));
    result.Set("unifiedSize", Napi::Number::From(info.Env(), unifiedVramSize));

    return result;
}

Napi::Value getGpuDeviceInfo(const Napi::CallbackInfo& info) {
    std::vector<std::string> deviceNames;

    for (size_t i = 0; i < ggml_backend_dev_count(); i++) {
        ggml_backend_dev_t device = ggml_backend_dev_get(i);
        if (ggml_backend_dev_type(device) == GGML_BACKEND_DEVICE_TYPE_GPU) {

            deviceNames.push_back(std::string(ggml_backend_dev_description(device)));
        }
    }

    Napi::Object result = Napi::Object::New(info.Env());

    Napi::Array deviceNamesNapiArray = Napi::Array::New(info.Env(), deviceNames.size());
    for (size_t i = 0; i < deviceNames.size(); ++i) {
        deviceNamesNapiArray[i] = Napi::String::New(info.Env(), deviceNames[i]);
    }
    result.Set("deviceNames", deviceNamesNapiArray);

    return result;
}

Napi::Value getGpuType(const Napi::CallbackInfo& info) {
    for (size_t i = 0; i < ggml_backend_dev_count(); i++) {
        ggml_backend_dev_t device = ggml_backend_dev_get(i);
        const auto deviceName = std::string(ggml_backend_dev_name(device));
        
        if (deviceName == "Metal") {
            return Napi::String::New(info.Env(), "metal");
        } else if (std::string(deviceName).find("Vulkan") == 0) {
            return Napi::String::New(info.Env(), "vulkan");
        } else if (std::string(deviceName).find("CUDA") == 0 || std::string(deviceName).find("ROCm") == 0 || std::string(deviceName).find("MUSA") == 0) {
            return Napi::String::New(info.Env(), "cuda");
        }
    }

    for (size_t i = 0; i < ggml_backend_dev_count(); i++) {
        ggml_backend_dev_t device = ggml_backend_dev_get(i);
        const auto deviceName = std::string(ggml_backend_dev_name(device));
        
        if (deviceName == "CPU") {
            return Napi::Boolean::New(info.Env(), false);
        }
    }

    return info.Env().Undefined();
}
