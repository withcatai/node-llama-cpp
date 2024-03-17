#pragma once

#include <stddef.h>

typedef void (*gpuInfoCudaErrorLogCallback_t)(const char* message);

bool gpuInfoGetTotalCudaDevicesInfo(size_t * total, size_t * used, gpuInfoCudaErrorLogCallback_t errorLogCallback);
