#pragma once

#include <stddef.h>
#include <vector>
#include <string>

typedef void (*gpuInfoCudaErrorLogCallback_t)(const char* message);

bool gpuInfoGetTotalCudaDevicesInfo(size_t * total, size_t * used, gpuInfoCudaErrorLogCallback_t errorLogCallback);
void gpuInfoGetCudaDeviceNames(std::vector<std::string> * deviceNames, gpuInfoCudaErrorLogCallback_t errorLogCallback);
