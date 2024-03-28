#pragma once

#include <stddef.h>
#include <vector>

typedef void (*gpuInfoVulkanWarningLogCallback_t)(const char* message);

bool gpuInfoGetTotalVulkanDevicesInfo(size_t* total, size_t* used, gpuInfoVulkanWarningLogCallback_t warningLogCallback);
bool gpuInfoGetVulkanDeviceNames(std::vector<std::string> * deviceNames, gpuInfoVulkanWarningLogCallback_t warningLogCallback);