#pragma once

#include <stddef.h>
#include <vector>

typedef void (*gpuInfoVulkanWarningLogCallback_t)(const char* message);

bool gpuInfoGetTotalVulkanDevicesInfo(size_t* total, size_t* used, size_t* unifiedMemorySize, gpuInfoVulkanWarningLogCallback_t warningLogCallback);
bool checkIsVulkanEnvSupported(gpuInfoVulkanWarningLogCallback_t warningLogCallback);
