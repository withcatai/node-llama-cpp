#include "getSwapInfo.h"
#include "addonLog.h"

#ifdef __APPLE__
#include <iostream>
#include <mach/mach.h>
#include <sys/sysctl.h>
#elif __linux__
#include <iostream>
#include <sys/sysinfo.h>
#elif _WIN32
#include <iostream>
#include <windows.h>
#include <psapi.h>
#endif


Napi::Value getSwapInfo(const Napi::CallbackInfo& info) {
    uint64_t totalSwap = 0;
    uint64_t freeSwap = 0;
    uint64_t maxSize = 0;
    bool maxSizeSet = true;

#ifdef __APPLE__
    struct xsw_usage swapInfo;
    size_t size = sizeof(swapInfo);

    if (sysctlbyname("vm.swapusage", &swapInfo, &size, NULL, 0) == 0) {
        totalSwap = swapInfo.xsu_total;
        freeSwap = swapInfo.xsu_avail;
        maxSizeSet = false;
    } else {
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, std::string("Failed to get swap info").c_str(), nullptr);
    }
#elif __linux__
    struct sysinfo sysInfo;

    if (sysinfo(&sysInfo) == 0) {
        totalSwap = sysInfo.totalswap;
        freeSwap = sysInfo.freeswap;
        maxSize = sysInfo.totalswap;
    } else {
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, std::string("Failed to get swap info").c_str(), nullptr);
    }
#elif _WIN32
    MEMORYSTATUSEX memInfo;
    memInfo.dwLength = sizeof(MEMORYSTATUSEX);

    if (GlobalMemoryStatusEx(&memInfo)) {
        PERFORMANCE_INFORMATION perfInfo;
        perfInfo.cb = sizeof(PERFORMANCE_INFORMATION);
        if (GetPerformanceInfo(&perfInfo, sizeof(perfInfo))) {
            totalSwap = memInfo.ullTotalPageFile;
            freeSwap = memInfo.ullAvailPageFile;
            maxSize = perfInfo.CommitLimit * perfInfo.PageSize;
        } else {
            addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, std::string("Failed to get max pagefile size").c_str(), nullptr);
        }
    } else {
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, std::string("Failed to get pagefile info").c_str(), nullptr);
    }
#endif
    
    Napi::Object obj = Napi::Object::New(info.Env());
    obj.Set("total", Napi::Number::New(info.Env(), totalSwap));
    obj.Set("free", Napi::Number::New(info.Env(), freeSwap));
    obj.Set("maxSize", maxSizeSet ? Napi::Number::New(info.Env(), maxSize) : Napi::Number::New(info.Env(), -1));
    return obj;
}
