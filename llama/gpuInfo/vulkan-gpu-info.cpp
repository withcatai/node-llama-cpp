#include <stddef.h>
#include <algorithm>
#include <cstdint>
#include <iterator>
#include <limits>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

#include <vulkan/vulkan.hpp>

constexpr std::uint32_t VK_VENDOR_ID_AMD = 0x1002;
constexpr std::uint32_t VK_VENDOR_ID_APPLE = 0x106b;
constexpr std::uint32_t VK_VENDOR_ID_INTEL = 0x8086;
constexpr std::uint32_t VK_VENDOR_ID_NVIDIA = 0x10de;
constexpr std::uint32_t VK_VENDOR_ID_QUALCOMM = 0x5143;

typedef void (*gpuInfoVulkanWarningLogCallback_t)(const char* message);

static bool addWithoutOverflow(uint64_t& target, uint64_t value) {
    if (value > std::numeric_limits<uint64_t>::max() - target) {
        return false;
    }

    target += value;
    return true;
}

static vk::Instance vulkanInstance() {
    static vk::Instance instance = []() {
        const uint32_t apiVersion = vk::enumerateInstanceVersion();
        if (apiVersion < VK_API_VERSION_1_2) {
            throw std::runtime_error("Vulkan 1.2 is not supported by the current system. Please update your Vulkan driver");
        }

        vk::ApplicationInfo appInfo("node-llama-cpp GPU info", 1, "llama.cpp", 1, VK_API_VERSION_1_2);
        vk::InstanceCreateInfo createInfo(vk::InstanceCreateFlags(), &appInfo, {}, {});
        return vk::createInstance(createInfo);
    }();

    return instance;
}

static bool deviceSupportsMemoryBudget(const vk::PhysicalDevice& physicalDevice) {
    std::vector<vk::ExtensionProperties> extensionProperties = physicalDevice.enumerateDeviceExtensionProperties();

    return std::any_of(
        extensionProperties.begin(),
        extensionProperties.end(),
        [](const vk::ExtensionProperties& ext) {
            return std::string(ext.extensionName.data()) == VK_EXT_MEMORY_BUDGET_EXTENSION_NAME;
        }
    );
}

static bool isVulkanDeviceSupported(const vk::PhysicalDevice& physicalDevice, std::string* unsupportedReason = nullptr) {
    if (unsupportedReason != nullptr) {
        unsupportedReason->clear();
    }

    VkPhysicalDeviceFeatures2 features2 = {};
    features2.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_FEATURES_2;

    VkPhysicalDeviceVulkan11Features vk11Features = {};
    vk11Features.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_VULKAN_1_1_FEATURES;
    features2.pNext = &vk11Features;

    vkGetPhysicalDeviceFeatures2(physicalDevice, &features2);

    if (!vk11Features.storageBuffer16BitAccess) {
        if (unsupportedReason != nullptr) {
            vk::PhysicalDeviceProperties deviceProps = physicalDevice.getProperties();
            *unsupportedReason =
                "Vulkan storageBuffer16BitAccess not supported for device \"" +
                std::string(deviceProps.deviceName.data()) + "\"";
        }

        return false;
    }

    if (!deviceSupportsMemoryBudget(physicalDevice)) {
        // VK_EXT_memory_budget extension is not supported, so we cannot determine used memory

        if (unsupportedReason != nullptr) {
            vk::PhysicalDeviceProperties deviceProps = physicalDevice.getProperties();
            *unsupportedReason = "Vulkan VK_EXT_memory_budget extension not supported for device \"" +
                                 std::string(deviceProps.deviceName.data()) + "\", so VRAM info cannot be determined for it";
        }

        return false;
    }

    return true;
}

static std::vector<vk::PhysicalDevice> dedupedDevices(gpuInfoVulkanWarningLogCallback_t warningLogCallback = nullptr) {
    vk::Instance instance = vulkanInstance();
    auto physicalDevices = instance.enumeratePhysicalDevices();
    std::vector<vk::PhysicalDevice> dedupedDevices;
    dedupedDevices.reserve(physicalDevices.size());

    // adapted from `ggml_vk_instance_init` in `ggml-vulkan.cpp`
    for (const auto& device : physicalDevices) {
        vk::PhysicalDeviceProperties deviceProps = device.getProperties();

        // ignore CPU devices, as we don't want to count RAM from the CPU as VRAM
        if (deviceProps.deviceType == vk::PhysicalDeviceType::eCpu) {
            continue;
        }

        std::string unsupportedReason;
        if (!isVulkanDeviceSupported(device, warningLogCallback != nullptr ? &unsupportedReason : nullptr)) {
            if (warningLogCallback != nullptr) {
                warningLogCallback(unsupportedReason.c_str());
            }

            continue;
        }

        vk::PhysicalDeviceProperties2 newProps;
        vk::PhysicalDeviceDriverProperties newDriver;
        vk::PhysicalDeviceIDProperties newId;
        newProps.pNext = &newDriver;
        newDriver.pNext = &newId;
        device.getProperties2(&newProps);

        auto oldDevice = std::find_if(
            dedupedDevices.begin(),
            dedupedDevices.end(),
            [&newId, &newDriver](const vk::PhysicalDevice& oldDevice) {
                vk::PhysicalDeviceProperties2 oldProps;
                vk::PhysicalDeviceDriverProperties oldDriver;
                vk::PhysicalDeviceIDProperties oldId;
                oldProps.pNext = &oldDriver;
                oldDriver.pNext = &oldId;
                oldDevice.getProperties2(&oldProps);

                bool sameUuid = std::equal(std::begin(oldId.deviceUUID), std::end(oldId.deviceUUID), std::begin(newId.deviceUUID));
                sameUuid = sameUuid || (
                    oldId.deviceLUIDValid && newId.deviceLUIDValid &&
                    std::equal(std::begin(oldId.deviceLUID), std::end(oldId.deviceLUID), std::begin(newId.deviceLUID))
                );
                bool bothMoltenVk = (newDriver.driverID == vk::DriverId::eMoltenvk && oldDriver.driverID == vk::DriverId::eMoltenvk);

                return sameUuid && !bothMoltenVk;
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
            case VK_VENDOR_ID_QUALCOMM:
                driverPriorities[vk::DriverId::eQualcommProprietary] = 1;
                driverPriorities[vk::DriverId::eMesaTurnip] = 2;
                break;
        }
        driverPriorities[vk::DriverId::eMesaDozen] = 100;

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

static bool enumerateVulkanDevices(uint64_t* total, uint64_t* used, uint64_t* unifiedMemorySize, bool addDeviceNames, std::vector<std::string> * deviceNames, gpuInfoVulkanWarningLogCallback_t warningLogCallback) {
    auto physicalDevices = dedupedDevices(warningLogCallback);

    uint64_t usedMem = 0;
    uint64_t totalMem = 0;
    uint64_t totalUnifiedMemorySize = 0;

    for (size_t i = 0; i < physicalDevices.size(); i++) {
        vk::PhysicalDevice physicalDevice = physicalDevices[i];
        vk::PhysicalDeviceProperties deviceProps = physicalDevice.getProperties();

        vk::PhysicalDeviceMemoryBudgetPropertiesEXT memoryBudgetProperties;
        vk::PhysicalDeviceMemoryProperties2 memProps2 = {};
        memProps2.pNext = &memoryBudgetProperties;

        physicalDevice.getMemoryProperties2(&memProps2);

        bool hasDeviceLocalHeap = false;

        for (uint32_t i = 0; i < memProps2.memoryProperties.memoryHeapCount; ++i) {
            const auto heap = memProps2.memoryProperties.memoryHeaps[i];

            if (heap.flags & vk::MemoryHeapFlagBits::eDeviceLocal) {
                const uint64_t heapSize = heap.size;
                const uint64_t heapBudget = std::min<uint64_t>(memoryBudgetProperties.heapBudget[i], heapSize);
                const uint64_t heapUsage = std::min<uint64_t>(memoryBudgetProperties.heapUsage[i], heapBudget);
                const uint64_t heapUsed = heapSize - (heapBudget - heapUsage);

                hasDeviceLocalHeap = heapSize != 0;

                if (!addWithoutOverflow(totalMem, heapSize) || !addWithoutOverflow(usedMem, heapUsed)) {
                    if (warningLogCallback != nullptr) {
                        warningLogCallback("Vulkan VRAM size overflow");
                    }

                    return false;
                }

                if (deviceProps.deviceType == vk::PhysicalDeviceType::eIntegratedGpu) {
                    if (!addWithoutOverflow(totalUnifiedMemorySize, heapSize)) {
                        if (warningLogCallback != nullptr) {
                            warningLogCallback("Vulkan unified VRAM size overflow");
                        }

                        return false;
                    }
                }
            }
        }

        if (hasDeviceLocalHeap && addDeviceNames) {
            (*deviceNames).push_back(std::string(deviceProps.deviceName.data()));
        }
    }

    *total = totalMem;
    *used = usedMem;
    *unifiedMemorySize = totalUnifiedMemorySize;

    return true;
}

bool gpuInfoGetTotalVulkanDevicesInfo(uint64_t* total, uint64_t* used, uint64_t* unifiedMemorySize, gpuInfoVulkanWarningLogCallback_t warningLogCallback) {
    try {
        return enumerateVulkanDevices(total, used, unifiedMemorySize, false, nullptr, warningLogCallback);
    } catch (const std::exception& err) {
        if (warningLogCallback != nullptr) {
            std::string message = "Failed to get Vulkan GPU info: " + std::string(err.what());
            warningLogCallback(message.c_str());
        }

        return false;
    }
}

bool checkIsVulkanEnvSupported(gpuInfoVulkanWarningLogCallback_t warningLogCallback) {
    try {
        static_cast<void>(vulkanInstance().enumeratePhysicalDevices());
        return true;
    } catch (const std::exception& err) {
        if (warningLogCallback != nullptr) {
            std::string message = "Failed to check Vulkan support: " + std::string(err.what());
            warningLogCallback(message.c_str());
        }

        return false;
    }
}