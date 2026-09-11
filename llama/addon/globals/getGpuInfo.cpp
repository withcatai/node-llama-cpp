#include "getGpuInfo.h"
#include "addonLog.h"

#ifdef __APPLE__
    #include <TargetConditionals.h>
#endif

#ifdef GPU_INFO_USE_VULKAN
#  include <stdexcept>
#  include <vulkan/vulkan.hpp>
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
        auto deviceType = ggml_backend_dev_type(device);
        if (deviceType == GGML_BACKEND_DEVICE_TYPE_GPU || deviceType == GGML_BACKEND_DEVICE_TYPE_IGPU) {
            deviceTotal = 0;
            deviceFree = 0;
            ggml_backend_dev_memory(device, &deviceFree, &deviceTotal);

            total += deviceTotal;
            used += deviceFree <= deviceTotal ? deviceTotal - deviceFree : deviceTotal;

            if (deviceType == GGML_BACKEND_DEVICE_TYPE_IGPU) {
                unifiedVramSize += deviceTotal;
            }

#if defined(__arm64__) || defined(__aarch64__)
            ggml_backend_reg_t backend = ggml_backend_dev_backend_reg(device);
            const auto backendName = std::string(backend == nullptr ? "" : ggml_backend_reg_name(backend));

            if (deviceType != GGML_BACKEND_DEVICE_TYPE_IGPU && (backendName == "MTL" || backendName == "Metal")) {
                unifiedVramSize += deviceTotal;
            }
#endif
        }
    }

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
        auto deviceType = ggml_backend_dev_type(device);
        if (deviceType == GGML_BACKEND_DEVICE_TYPE_GPU || deviceType == GGML_BACKEND_DEVICE_TYPE_IGPU) {
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

std::pair<ggml_backend_dev_t, std::string> getGpuDevice() {
    for (size_t i = 0; i < ggml_backend_dev_count(); i++) {
        ggml_backend_dev_t device = ggml_backend_dev_get(i);
        const auto deviceName = std::string(ggml_backend_dev_name(device));

        if (std::string(deviceName).find("MTL") == 0 || deviceName == "Metal") {
            return std::pair<ggml_backend_dev_t, std::string>(device, "metal");
        } else if (std::string(deviceName).find("Vulkan") == 0) {
            return std::pair<ggml_backend_dev_t, std::string>(device, "vulkan");
        } else if (std::string(deviceName).find("CUDA") == 0 || std::string(deviceName).find("ROCm") == 0 || std::string(deviceName).find("MUSA") == 0) {
            return std::pair<ggml_backend_dev_t, std::string>(device, "cuda");
        }
    }

    for (size_t i = 0; i < ggml_backend_dev_count(); i++) {
        ggml_backend_dev_t device = ggml_backend_dev_get(i);
        const auto deviceName = std::string(ggml_backend_dev_name(device));

        if (deviceName == "CPU") {
            return std::pair<ggml_backend_dev_t, std::string>(device, "cpu");
        }
    }

    return std::pair<ggml_backend_dev_t, std::string>(nullptr, "");
}

Napi::Value getGpuType(const Napi::CallbackInfo& info) {
    for (size_t i = 0; i < ggml_backend_reg_count(); i++) {
        ggml_backend_reg_t backend = ggml_backend_reg_get(i);
        const auto backendName = std::string(ggml_backend_reg_name(backend));

        if (backendName == "MTL" || backendName == "Metal") {
            return Napi::String::New(info.Env(), "metal");
        } else if (backendName == "Vulkan") {
            return Napi::String::New(info.Env(), "vulkan");
        }

        // else if (
        //     backendName == "CUDA" || backendName == "ROCm" || backendName == "MUSA") {
        //     return Napi::String::New(info.Env(), "cuda");
        // }
    }

    const auto gpuDeviceRes = getGpuDevice();
    const auto device = gpuDeviceRes.first;
    const auto deviceType = gpuDeviceRes.second;

    if (deviceType == "cpu") {
        return Napi::Boolean::New(info.Env(), false);
    } else if (device != nullptr && deviceType != "") {
        return Napi::String::New(info.Env(), deviceType);
    }

    return info.Env().Undefined();
}

Napi::Value ensureGpuDeviceIsSupported(const Napi::CallbackInfo& info) {
#ifdef GPU_INFO_USE_VULKAN
    try {
        static vk::Instance instance = []() {
            if (vk::enumerateInstanceVersion() < VK_API_VERSION_1_2) {
                throw std::runtime_error("Vulkan 1.2 is not supported by the current system. Please update your Vulkan driver");
            }

            vk::ApplicationInfo appInfo("node-llama-cpp GPU info", 1, "llama.cpp", 1, VK_API_VERSION_1_2);
            vk::InstanceCreateInfo createInfo(vk::InstanceCreateFlags(), &appInfo, {}, {});
            return vk::createInstance(createInfo);
        }();

        static_cast<void>(instance.enumeratePhysicalDevices());
    } catch (const std::exception& err) {
        const std::string message = std::string("Vulkan warning: Failed to check Vulkan support: ") + err.what();
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_WARN, message.c_str(), nullptr);
        Napi::Error::New(info.Env(), "Vulkan device is not supported").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }
#endif

    return info.Env().Undefined();
}
