#include <stddef.h>
#include <vector>

#include <vulkan/vulkan.hpp>

typedef void (*gpuInfoVulkanWarningLogCallback_t)(const char* message);

static bool enumerateVulkanDevices(size_t* total, size_t* used, size_t* unifiedMemorySize, bool addDeviceNames, std::vector<std::string> * deviceNames, gpuInfoVulkanWarningLogCallback_t warningLogCallback, bool * checkSupported) {
    vk::ApplicationInfo appInfo("node-llama-cpp GPU info", 1, "llama.cpp", 1, VK_API_VERSION_1_2);
    vk::InstanceCreateInfo createInfo(vk::InstanceCreateFlags(), &appInfo, {}, {});
    vk::Instance instance = vk::createInstance(createInfo);

    auto physicalDevices = instance.enumeratePhysicalDevices();

    size_t usedMem = 0;
    size_t totalMem = 0;
    size_t totalUnifiedMemorySize = 0;

    for (size_t i = 0; i < physicalDevices.size(); i++) {
        vk::PhysicalDevice physicalDevice = physicalDevices[i];
        vk::PhysicalDeviceMemoryProperties memProps = physicalDevice.getMemoryProperties();
        vk::PhysicalDeviceProperties deviceProps = physicalDevice.getProperties();

        if (deviceProps.deviceType == vk::PhysicalDeviceType::eCpu) {
            // ignore CPU devices, as we don't want to count RAM from the CPU as VRAM
            continue;
        }

        std::vector<vk::ExtensionProperties> extensionProperties = physicalDevice.enumerateDeviceExtensionProperties();
        bool memoryBudgetExtensionSupported =
            std::any_of(
                extensionProperties.begin(),
                extensionProperties.end(),
                [](const vk::ExtensionProperties& ext) { return std::string(ext.extensionName.data()) == VK_EXT_MEMORY_BUDGET_EXTENSION_NAME;}
            );

        if (memoryBudgetExtensionSupported) {
            vk::PhysicalDeviceMemoryBudgetPropertiesEXT memoryBudgetProperties;
            vk::PhysicalDeviceMemoryProperties2 memProps2 = {};
            memProps2.pNext = &memoryBudgetProperties;

            physicalDevice.getMemoryProperties2(&memProps2);

            for (uint32_t i = 0; i < memProps.memoryHeapCount; ++i) {
                const auto flags = memProps.memoryHeaps[i].flags;

                if (flags & vk::MemoryHeapFlagBits::eDeviceLocal) {
                    const auto size = memProps.memoryHeaps[i].size;
                    totalMem += size;
                    usedMem += memoryBudgetProperties.heapUsage[i];

                    if (flags & vk::MemoryHeapFlagBits::eMultiInstance) {
                        totalUnifiedMemorySize += size;
                    }

                    if (size > 0 && addDeviceNames) {
                        (*deviceNames).push_back(std::string(deviceProps.deviceName.data()));
                    }

                    if (checkSupported != nullptr && checkSupported) {
                        VkPhysicalDeviceFeatures2 features2 = {};
                        features2.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_FEATURES_2;

                        VkPhysicalDeviceVulkan11Features vk11Features = {};
                        vk11Features.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_VULKAN_1_1_FEATURES;
                        features2.pNext = &vk11Features;

                        vkGetPhysicalDeviceFeatures2(physicalDevice, &features2);

                        if (!vk11Features.storageBuffer16BitAccess) {
                            *checkSupported = false;
                        }
                    }
                }
            }
        } else {
            // VK_EXT_memory_budget extension is not supported, so we cannot determine used memory
            warningLogCallback(
                (
                    "Vulkan VK_EXT_memory_budget extension not supported for device \"" +
                    std::string(deviceProps.deviceName.data()) + "\", so VRAM info cannot be determined for it"
                ).c_str()
            );
            return false;
        }
    }

    *total = totalMem;
    *used = usedMem;
    *unifiedMemorySize = totalUnifiedMemorySize;

    return true;
}

bool gpuInfoGetTotalVulkanDevicesInfo(size_t* total, size_t* used, size_t* unifiedMemorySize, gpuInfoVulkanWarningLogCallback_t warningLogCallback) {
    return enumerateVulkanDevices(total, used, unifiedMemorySize, false, nullptr, warningLogCallback, nullptr);
}

bool checkIsVulkanEnvSupported(gpuInfoVulkanWarningLogCallback_t warningLogCallback) {
    size_t total = 0;
    size_t used = 0;
    size_t unifiedMemorySize = 0;

    bool isSupported = true;
    enumerateVulkanDevices(&total, &used, &unifiedMemorySize, false, nullptr, warningLogCallback, &isSupported);

    return isSupported;
}
