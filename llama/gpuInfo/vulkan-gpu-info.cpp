#include <stddef.h>
#include <vulkan/vulkan>
// #include <vulkan/vulkan.hpp>

bool gpuInfoGetTotalVulkanDevicesInfo(size_t* total, size_t* used) {
    vk::ApplicationInfo appInfo("node-llama-cpp GPU info", 1, "llama.cpp", 1, VK_API_VERSION);
    vk::InstanceCreateInfo createInfo(vk::InstanceCreateFlags(), &appInfo, {}, {});
    vk::Instance instance = vk::createInstance(createInfo);
    
    auto physicalDevices = instance.enumeratePhysicalDevices();

    size_t usedMem = 0;
    size_t totalMem = 0;

    for (size_t i = 0; i < physicalDevices.size(); i++) {
        vk::PhysicalDevice physicalDevice = physicalDevices[i];
        vk::PhysicalDeviceMemoryProperties memProps = physicalDevice.getMemoryProperties();

        std::vector<vk::ExtensionProperties> extensionProperties = physicalDevice.enumerateDeviceExtensionProperties();
        bool memoryBudgetExtensionSupported = std::any_of(
            extensionProperties.begin(), 
            extensionProperties.end(), 
            [](const vk::ExtensionProperties& ext) { return std::string(ext.extensionName) == VK_EXT_MEMORY_BUDGET_EXTENSION_NAME; }
        );

        if (memoryBudgetExtensionSupported) {
            vk::PhysicalDeviceMemoryBudgetPropertiesEXT memoryBudgetProperties;
            vk::PhysicalDeviceMemoryProperties2 memProps2 = {};
            memProps2.pNext = &memoryBudgetProperties;

            physicalDevice.getMemoryProperties2(&memProps2);

            for (uint32_t i = 0; i < memProps.memoryHeapCount; ++i) {
                if (memProps.memoryHeaps[i].flags & vk::MemoryHeapFlagBits::eDeviceLocal) {
                    totalMem += memProps.memoryHeaps[i].size;
                    usedMem += memoryBudgetProperties.heapUsage[i];
                    break;
                }
            }
        } else {
            // VK_EXT_memory_budget extension is not supported, se we cannot determine used memory
            std::cerr << "VK_EXT_memory_budget extension not supported" << std::endl;
            return false;
        }
    }

    *total = totalMem;
    *used = usedMem;
    return true;
}
