#include <stddef.h>
#include <vector>
#include <string>

#if defined(GPU_INFO_USE_HIPBLAS)
#include <hip/hip_runtime.h>
#include <hipblas/hipblas.h>
#define cudaGetDevice hipGetDevice
#define cudaGetDeviceCount hipGetDeviceCount
#define cudaGetErrorString hipGetErrorString
#define cudaMemGetInfo hipMemGetInfo
#define cudaSetDevice hipSetDevice
#define cudaSuccess hipSuccess
#else
#include <cuda_runtime.h>
#include <cuda.h>
#endif


typedef void (*gpuInfoCudaErrorLogCallback_t)(const char* message);

bool gpuInfoSetCudaDevice(const int device, gpuInfoCudaErrorLogCallback_t errorLogCallback) {
    int current_device;
    auto getDeviceResult = cudaGetDevice(&current_device);

    if (getDeviceResult != cudaSuccess) {
        errorLogCallback(cudaGetErrorString(getDeviceResult));
        return false;
    }

    if (device == current_device) {
        return true;
    }

    const auto setDeviceResult = cudaSetDevice(device);

    if (setDeviceResult != cudaSuccess) {
        errorLogCallback(cudaGetErrorString(setDeviceResult));
        return false;
    }

    return true;
}

bool gpuInfoGetCudaDeviceInfo(int device, size_t * total, size_t * used, gpuInfoCudaErrorLogCallback_t errorLogCallback) {
    gpuInfoSetCudaDevice(device, errorLogCallback);

    size_t freeMem;
    size_t totalMem;
    auto getMemInfoResult = cudaMemGetInfo(&freeMem, &totalMem);

    if (getMemInfoResult != cudaSuccess) {
        errorLogCallback(cudaGetErrorString(getMemInfoResult));
        return false;
    }

    *total = totalMem;
    *used = totalMem - freeMem;

    return true;
}

int gpuInfoGetCudaDeviceCount(gpuInfoCudaErrorLogCallback_t errorLogCallback) {
    int deviceCount;
    auto getDeviceCountResult = cudaGetDeviceCount(&deviceCount);

    if (getDeviceCountResult != cudaSuccess) {
        errorLogCallback(cudaGetErrorString(getDeviceCountResult));
        return -1;
    }

    return deviceCount;
}

bool gpuInfoGetTotalCudaDevicesInfo(size_t * total, size_t * used, gpuInfoCudaErrorLogCallback_t errorLogCallback) {
    int deviceCount = gpuInfoGetCudaDeviceCount(errorLogCallback);

    if (deviceCount < 0) {
        return false;
    }

    size_t usedMem = 0;
    size_t totalMem = 0;

    for (int i = 0; i < deviceCount; i++) {
        size_t deviceUsedMem;
        size_t deviceTotalMem;

        if (!gpuInfoGetCudaDeviceInfo(i, &deviceTotalMem, &deviceUsedMem, errorLogCallback)) {
            return false;
        }

        usedMem += deviceUsedMem;
        totalMem += deviceTotalMem;
    }

    *total = totalMem;
    *used = usedMem;

    return true;
}

void gpuInfoGetCudaDeviceNames(std::vector<std::string> * deviceNames, gpuInfoCudaErrorLogCallback_t errorLogCallback) {
    int deviceCount = gpuInfoGetCudaDeviceCount(errorLogCallback);

    if (deviceCount < 0) {
        return;
    }

    for (int i = 0; i < deviceCount; i++) {
        cudaDeviceProp prop;
        auto getDevicePropertiesResult = cudaGetDeviceProperties(&prop, i);

        if (getDevicePropertiesResult != cudaSuccess) {
            errorLogCallback(cudaGetErrorString(getDevicePropertiesResult));
        } else {
            (*deviceNames).push_back(std::string(prop.name));
        }
    }
}
