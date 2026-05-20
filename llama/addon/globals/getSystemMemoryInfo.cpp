#include "getSystemMemoryInfo.h"
#include "addonLog.h"

#include <algorithm>
#include <cmath>
#include <cctype>
#include <cstdint>
#include <limits>
#include <optional>
#include <string>

#ifdef __APPLE__
#include <mach/mach.h>
#include <sys/sysctl.h>
#elif __linux__
#include <fstream>
#elif _WIN32
#include <windows.h>
#endif

struct AddonSystemMemoryInfo {
    std::optional<uint64_t> total = std::nullopt;
    std::optional<uint64_t> useful = std::nullopt;
    std::optional<uint64_t> free = std::nullopt;
};

#ifdef __APPLE__
struct AddonHostPortScopeExit {
    mach_port_t hostPort;

    explicit AddonHostPortScopeExit(mach_port_t hostPort)
        : hostPort(hostPort) {
    }

    ~AddonHostPortScopeExit() {
        if (hostPort != MACH_PORT_NULL)
            mach_port_deallocate(mach_task_self(), hostPort);
    }
};
#endif

#ifdef __linux__
static bool isLinuxMeminfoWhitespace(char character) {
    return character == ' ' || character == '\t';
}

static std::string toLowerAscii(std::string value) {
    for (char& character : value) {
        character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    }

    return value;
}

static std::optional<long double> parseLinuxMeminfoNumericValue(const std::string& value, size_t& index) {
    long double parsedValue = 0;
    bool sawDigit = false;

    while (index < value.size() && std::isdigit(static_cast<unsigned char>(value[index]))) {
        sawDigit = true;
        parsedValue = (parsedValue * 10) + (value[index] - '0');
        index++;
    }

    if (index < value.size() && value[index] == '.') {
        index++;

        long double fractionalScale = 1;
        while (index < value.size() && std::isdigit(static_cast<unsigned char>(value[index]))) {
            sawDigit = true;
            fractionalScale *= 10;
            parsedValue += static_cast<long double>(value[index] - '0') / fractionalScale;
            index++;
        }
    }

    if (!sawDigit) {
        return std::nullopt;
    }

    return parsedValue;
}

static std::optional<uint64_t> getLinuxMeminfoUnitMultiplier(const std::string& rawUnit) {
    if (rawUnit == "") {
        return uint64_t(1);
    }
    
    if (rawUnit == "kB") {
        return uint64_t(1024);
    }
    
    const std::string lowercaseUnit = toLowerAscii(rawUnit);
    if (lowercaseUnit == "b" || lowercaseUnit == "byte" || lowercaseUnit == "bytes") {
        return uint64_t(1);
    } else if (lowercaseUnit == "kib" || lowercaseUnit == "ki") {
        return uint64_t(1024);
    } else if (lowercaseUnit == "kb" || lowercaseUnit == "k") {
        return uint64_t(1000);
    } else if (lowercaseUnit == "mb" || lowercaseUnit == "m") {
        return uint64_t(1000) * 1000;
    } else if (lowercaseUnit == "gb" || lowercaseUnit == "g") {
        return uint64_t(1000) * 1000 * 1000;
    } else if (lowercaseUnit == "tb" || lowercaseUnit == "t") {
        return uint64_t(1000) * 1000 * 1000 * 1000;
    } else if (lowercaseUnit == "pb" || lowercaseUnit == "p") {
        return uint64_t(1000) * 1000 * 1000 * 1000 * 1000;
    } else if (lowercaseUnit == "mib" || lowercaseUnit == "mi") {
        return uint64_t(1024) * 1024;
    } else if (lowercaseUnit == "gib" || lowercaseUnit == "gi") {
        return uint64_t(1024) * 1024 * 1024;
    } else if (lowercaseUnit == "tib" || lowercaseUnit == "ti") {
        return uint64_t(1024) * 1024 * 1024 * 1024;
    } else if (lowercaseUnit == "pib" || lowercaseUnit == "pi") {
        return uint64_t(1024) * 1024 * 1024 * 1024 * 1024;
    }

    return std::nullopt;
}

static std::optional<uint64_t> parseLinuxMeminfoValueBytes(const std::string& line, std::string& key) {
    const size_t separatorIndex = line.find(':');
    if (separatorIndex == std::string::npos || separatorIndex == 0) {
        return std::nullopt;
    }

    key = line.substr(0, separatorIndex);

    size_t index = separatorIndex + 1;
    while (index < line.size() && isLinuxMeminfoWhitespace(line[index])) {
        index++;
    }

    const std::optional<long double> parsedValue = parseLinuxMeminfoNumericValue(line, index);
    if (!parsedValue.has_value()) {
        return std::nullopt;
    }

    while (index < line.size() && isLinuxMeminfoWhitespace(line[index])) {
        index++;
    }

    const size_t unitStartIndex = index;
    while (index < line.size() && !isLinuxMeminfoWhitespace(line[index])) {
        index++;
    }

    const std::string unit = line.substr(unitStartIndex, index - unitStartIndex);

    while (index < line.size() && isLinuxMeminfoWhitespace(line[index])) {
        index++;
    }

    if (index != line.size()) {
        return std::nullopt;
    }

    const std::optional<uint64_t> unitMultiplier = getLinuxMeminfoUnitMultiplier(unit);
    if (!unitMultiplier.has_value()) {
        return std::nullopt;
    }

    const long double bytesValue = parsedValue.value() * unitMultiplier.value();
    if (!std::isfinite(bytesValue) || bytesValue < 0) {
        return std::nullopt;
    }

    const long double roundedBytesValue = std::round(bytesValue);
    if (roundedBytesValue > static_cast<long double>(std::numeric_limits<uint64_t>::max())) {
        return std::nullopt;
    }

    return static_cast<uint64_t>(roundedBytesValue);
}
#endif

static AddonSystemMemoryInfo retrieveSystemMemoryInfo() {
    AddonSystemMemoryInfo systemMemoryInfo;

#ifdef __APPLE__
    {
        uint64_t physicalMemory = 0;
        size_t physicalMemorySize = sizeof(physicalMemory);
        if (sysctlbyname("hw.memsize", &physicalMemory, &physicalMemorySize, NULL, 0) == 0) {
            systemMemoryInfo.total = physicalMemory;
        } else {
            addonLog(GGML_LOG_LEVEL_ERROR, "Failed to get total system memory");
        }
    }

    mach_port_t hostPort = mach_host_self();
    AddonHostPortScopeExit hostPortGuard(hostPort);
    vm_size_t pageSize = 0;
    if (host_page_size(hostPort, &pageSize) == KERN_SUCCESS) {
        vm_statistics64_data_t vmStats;
        mach_msg_type_number_t infoCount = HOST_VM_INFO64_COUNT;
        if (host_statistics64(hostPort, HOST_VM_INFO64, (host_info64_t)&vmStats, &infoCount) == KERN_SUCCESS) {
            const uint64_t freeBytes = uint64_t(vmStats.free_count) * pageSize;
            const uint64_t purgeableBytes = uint64_t(vmStats.purgeable_count) * pageSize;

            const uint64_t reclaimableFileCachePages = std::min<uint64_t>(vmStats.inactive_count, vmStats.external_page_count);
            const uint64_t reclaimableFileCacheBytes = reclaimableFileCachePages * pageSize;

            systemMemoryInfo.free = freeBytes;
            systemMemoryInfo.useful = freeBytes + purgeableBytes + reclaimableFileCacheBytes;
        } else {
            addonLog(GGML_LOG_LEVEL_ERROR, "Failed to get useful system memory");
        }
    } else {
        addonLog(GGML_LOG_LEVEL_ERROR, "Failed to get system page size");
    }
#elif __linux__
    std::ifstream procMeminfo("/proc/meminfo");
    if (!procMeminfo.is_open()) {
        addonLog(GGML_LOG_LEVEL_ERROR, "Failed to open /proc/meminfo");
        return systemMemoryInfo;
    }

    std::string line;
    uint64_t buffersBytes = 0;
    uint64_t cachedBytes = 0;
    uint64_t sReclaimableBytes = 0;
    uint64_t shmemBytes = 0;

    while (std::getline(procMeminfo, line)) {
        std::string key;
        const std::optional<uint64_t> valueBytes = parseLinuxMeminfoValueBytes(line, key);
        if (!valueBytes.has_value()) {
            continue;
        }

        if (key == "MemTotal") {
            systemMemoryInfo.total = valueBytes.value();
        } else if (key == "MemAvailable") {
            systemMemoryInfo.useful = valueBytes.value();
        } else if (key == "MemFree") {
            systemMemoryInfo.free = valueBytes.value();
        } else if (key == "Buffers")
            buffersBytes = valueBytes.value();
        else if (key == "Cached")
            cachedBytes = valueBytes.value();
        else if (key == "SReclaimable")
            sReclaimableBytes = valueBytes.value();
        else if (key == "Shmem")
            shmemBytes = valueBytes.value();
    }

    if (!systemMemoryInfo.useful.has_value() && systemMemoryInfo.free.has_value()) {
        // fallback approximation on older kernels when `MemAvailable` is absent
        systemMemoryInfo.useful = (
            systemMemoryInfo.free.value() + buffersBytes + cachedBytes + sReclaimableBytes -
            std::min<uint64_t>(cachedBytes + sReclaimableBytes, shmemBytes)
        );
    } else {
        addonLog(GGML_LOG_LEVEL_ERROR, "Failed to get useful system memory");
    }
#elif _WIN32
    MEMORYSTATUSEX memoryStatus;
    memoryStatus.dwLength = sizeof(MEMORYSTATUSEX);

    if (GlobalMemoryStatusEx(&memoryStatus)) {
        systemMemoryInfo.total = memoryStatus.ullTotalPhys;
        systemMemoryInfo.useful = memoryStatus.ullAvailPhys;
        systemMemoryInfo.free = memoryStatus.ullAvailPhys;
    } else {
        addonLog(GGML_LOG_LEVEL_ERROR, "Failed to get useful system memory");
    }
#endif

    if (systemMemoryInfo.total.has_value() && systemMemoryInfo.useful.has_value())
        systemMemoryInfo.useful = std::min(systemMemoryInfo.useful.value(), systemMemoryInfo.total.value());

    if (systemMemoryInfo.total.has_value() && systemMemoryInfo.free.has_value())
        systemMemoryInfo.free = std::min(systemMemoryInfo.free.value(), systemMemoryInfo.total.value());

    return systemMemoryInfo;
}

class AddonGetSystemMemoryInfoWorker : public Napi::AsyncWorker {
    public:
        explicit AddonGetSystemMemoryInfoWorker(const Napi::Env& env)
            : Napi::AsyncWorker(env, "AddonGetSystemMemoryInfoWorker"),
              deferred(Napi::Promise::Deferred::New(env)) {
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;
        AddonSystemMemoryInfo systemMemoryInfo;

        void Execute() override {
            try {
                systemMemoryInfo = retrieveSystemMemoryInfo();
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch (...) {
                SetError("Unknown error when getting system memory info");
            }
        }

        void OnOK() override {
            Napi::Object result = Napi::Object::New(Env());
            result.Set(
                "total",
                systemMemoryInfo.total.has_value()
                    ? Napi::Number::New(Env(), systemMemoryInfo.total.value())
                    : Env().Null()
            );
            result.Set(
                "useful",
                systemMemoryInfo.useful.has_value()
                    ? Napi::Number::New(Env(), systemMemoryInfo.useful.value())
                    : Env().Null()
            );
            result.Set(
                "free",
                systemMemoryInfo.free.has_value()
                    ? Napi::Number::New(Env(), systemMemoryInfo.free.value())
                    : Env().Null()
            );
            deferred.Resolve(result);
        }

        void OnError(const Napi::Error& err) override {
            deferred.Reject(err.Value());
        }
};

Napi::Value getSystemMemoryInfo(const Napi::CallbackInfo& info) {
    AddonGetSystemMemoryInfoWorker* worker = new AddonGetSystemMemoryInfoWorker(info.Env());
    worker->Queue();
    return worker->GetPromise();
}
