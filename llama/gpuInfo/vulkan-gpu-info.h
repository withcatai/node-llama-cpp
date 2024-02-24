#pragma once

#include <stddef.h>

typedef void (*gpuInfoVulkanWarningLogCallback_t)(const char* message);

bool gpuInfoGetTotalVulkanDevicesInfo(size_t* total, size_t* used, gpuInfoVulkanWarningLogCallback_t warningLogCallback);
