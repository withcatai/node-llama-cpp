#include <stddef.h>
#include <map>
#include <vector>

#include <vulkan/vulkan.hpp>

constexpr std::uint32_t VK_VENDOR_ID_AMD = 0x1002;
constexpr std::uint32_t VK_VENDOR_ID_APPLE = 0x106b;
constexpr std::uint32_t VK_VENDOR_ID_INTEL = 0x8086;
constexpr std::uint32_t VK_VENDOR_ID_NVIDIA = 0x10de;

typedef void (*gpuInfoVulkanWarningLogCallback_t)(const char* message);

static vk::Instance vulkanInstance() {
    vk::ApplicationInfo appInfo("node-llama-cpp GPU info", 1, "llama.cpp", 1, VK_API_VERSION_1_2);
    vk::InstanceCreateInfo createInfo(vk::InstanceCreateFlags(), &appInfo, {}, {});
    return vk::createInstance(createInfo);
}

static std::vector<vk::PhysicalDevice> dedupedDevices() {
    vk::Instance instance = vulkanInstance();
    auto physicalDevices = instance.enumeratePhysicalDevices();
    std::vector<vk::PhysicalDevice> dedupedDevices;
    dedupedDevices.reserve(physicalDevices.size());

    // adapted from `ggml_vk_instance_init` in `ggml-vulkan.cpp`
    for (const auto& device : physicalDevices) {
        vk::PhysicalDeviceProperties2 newProps;
        vk::PhysicalDeviceDriverProperties newDriver;
        vk::PhysicalDeviceIDProperties newId;
        newProps.pNext = &newDriver;
        newDriver.pNext = &newId;
        device.getProperties2(&newProps);

        auto oldDevice = std::find_if(
            dedupedDevices.begin(),
            dedupedDevices.end(),
            [&newId](const vk::PhysicalDevice& oldDevice) {
                vk::PhysicalDeviceProperties2 oldProps;
                vk::PhysicalDeviceDriverProperties oldDriver;
                vk::PhysicalDeviceIDProperties oldId;
                oldProps.pNext = &oldDriver;
                oldDriver.pNext = &oldId;
                oldDevice.getProperties2(&oldProps);

                bool equals = std::equal(std::begin(oldId.deviceUUID), std::end(oldId.deviceUUID), std::begin(newId.deviceUUID));
                equals = equals || (
                    oldId.deviceLUIDValid && newId.deviceLUIDValid &&
                    std::equal(std::begin(oldId.deviceLUID), std::end(oldId.deviceLUID), std::begin(newId.deviceLUID))
                );

                return equals;
            }
        );

        if (oldDevice == dedupedDevices.end()) {
            dedupedDevices.push_back(device);
            continue;
        }

        vk::PhysicalDeviceProperties2 oldProps;
        vk::PhysicalDeviceDriverProperties oldDriver;
        oldProps.pNext = &oldDriver;
        oldDevice->getProperties2(&oldProps);

        std::map<vk::DriverId, int> driverPriorities {};
        int oldPriority = 1000;
        int newPriority = 1000;

        switch (oldProps.properties.vendorID) {
            case VK_VENDOR_ID_AMD:
                driverPriorities[vk::DriverId::eMesaRadv] = 1;
                driverPriorities[vk::DriverId::eAmdOpenSource] = 2;
                driverPriorities[vk::DriverId::eAmdProprietary] = 3;
                break;
            case VK_VENDOR_ID_INTEL:
                driverPriorities[vk::DriverId::eIntelOpenSourceMESA] = 1;
                driverPriorities[vk::DriverId::eIntelProprietaryWindows] = 2;
                break;
            case VK_VENDOR_ID_NVIDIA:
                driverPriorities[vk::DriverId::eNvidiaProprietary] = 1;
#if defined(VK_API_VERSION_1_3) && VK_HEADER_VERSION >= 235
                driverPriorities[vk::DriverId::eMesaNvk] = 2;
#endif
                break;
        }
        driverPriorities[vk::DriverId::eMesaDozen] = 4;

        if (driverPriorities.count(oldDriver.driverID)) {
            oldPriority = driverPriorities[oldDriver.driverID];
        }
        if (driverPriorities.count(newDriver.driverID)) {
            newPriority = driverPriorities[newDriver.driverID];
        }

        if (newPriority < oldPriority) {
            dedupedDevices.erase(std::remove(dedupedDevices.begin(), dedupedDevices.end(), *oldDevice), dedupedDevices.end());
            dedupedDevices.push_back(device);
        }
    }

    return dedupedDevices;
}

static bool enumerateVulkanDevices(size_t* total, size_t* used, size_t* unifiedMemorySize, bool addDeviceNames, std::vector<std::string> * deviceNames, gpuInfoVulkanWarningLogCallback_t warningLogCallback, bool * checkSupported) {
    auto physicalDevices = dedupedDevices();

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
                const auto heap = memProps2.memoryProperties.memoryHeaps[i];

                if (heap.flags & vk::MemoryHeapFlagBits::eDeviceLocal) {
                    totalMem += heap.size;
                    usedMem += memoryBudgetProperties.heapUsage[i] + (heap.size - memoryBudgetProperties.heapBudget[i]);

                    if (heap.flags & vk::MemoryHeapFlagBits::eMultiInstance) {
                        totalUnifiedMemorySize += heap.size;
                    }

                    if (heap.size > 0 && addDeviceNames) {
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
