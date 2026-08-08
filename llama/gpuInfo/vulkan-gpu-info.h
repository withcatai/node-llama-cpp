#pragma once

#include <stddef.h>
#include <vector>

typedef void (*gpuInfoVulkanWarningLogCallback_t)(const char* message);

bool gpuInfoGetTotalVulkanDevicesInfo(uint64_t* total, uint64_t* used, uint64_t* unifiedMemorySize, gpuInfoVulkanWarningLogCallback_t warningLogCallback);
bool checkIsVulkanEnvSupported(gpuInfoVulkanWarningLogCallback_t warningLogCallback);
