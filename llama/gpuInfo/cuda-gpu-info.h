#pragma once

#include <stddef.h>

typedef void (*gpuInfoErrorLogCallback_t)(const char* message);

bool gpuInfoGetTotalCudaDevicesInfo(size_t * total, size_t * used, gpuInfoErrorLogCallback_t errorLogCallback);
