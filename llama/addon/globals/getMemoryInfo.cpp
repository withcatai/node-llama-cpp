#include "getMemoryInfo.h"
#include "addonLog.h"

#ifdef __APPLE__
#include <iostream>
#include <mach/mach.h>
#include <sys/sysctl.h>
#elif __linux__
#include <fstream>
#include <sstream>
#include <string>
#elif _WIN32
#include <iostream>
#include <windows.h>
#include <psapi.h>
#endif


Napi::Value getMemoryInfo(const Napi::CallbackInfo& info) {
    uint64_t totalMemoryUsage = 0;

#ifdef __APPLE__
    struct mach_task_basic_info taskInfo;
    mach_msg_type_number_t infoCount = MACH_TASK_BASIC_INFO_COUNT;
    if (task_info(mach_task_self(), MACH_TASK_BASIC_INFO, (task_info_t)&taskInfo, &infoCount) == KERN_SUCCESS) {
        totalMemoryUsage = taskInfo.virtual_size;
    } else {
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, std::string("Failed to get memory usage info").c_str(), nullptr);
    }
#elif __linux__
    std::ifstream procStatus("/proc/self/status");
    std::string line;
    bool foundMemoryUsage = false;
    while (std::getline(procStatus, line)) {
        if (line.rfind("VmSize:", 0) == 0) { // Resident Set Size (current memory usage)
            std::istringstream iss(line);
            std::string key, unit;
            size_t value;
            if (iss >> key >> value >> unit) {
                totalMemoryUsage = value * 1024; // Convert from kB to bytes
                foundMemoryUsage = true;
            }
            break;
        }
    }

    if (!foundMemoryUsage) {
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, std::string("Failed to get memory usage info").c_str(), nullptr);
    }
#elif _WIN32
    PROCESS_MEMORY_COUNTERS_EX memCounters;

    if (GetProcessMemoryInfo(GetCurrentProcess(), (PROCESS_MEMORY_COUNTERS*)&memCounters, sizeof(memCounters))) {
        totalMemoryUsage = memCounters.PrivateUsage;
    } else {
        addonLlamaCppLogCallback(GGML_LOG_LEVEL_ERROR, std::string("Failed to get memory usage info").c_str(), nullptr);
    }
#endif
    
    Napi::Object obj = Napi::Object::New(info.Env());
    obj.Set("total", Napi::Number::New(info.Env(), totalMemoryUsage));
    return obj;
}
