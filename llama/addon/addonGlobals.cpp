#include <sstream>
#include <vector>
#include "addonGlobals.h"
#include "napi.h"

void adjustNapiExternalMemoryAdd(Napi::Env env, uint64_t size) {
    const uint64_t chunkSize = std::numeric_limits<int64_t>::max();
    while (size > 0) {
        int64_t adjustSize = std::min(size, chunkSize);
        Napi::MemoryManagement::AdjustExternalMemory(env, adjustSize);
        size -= adjustSize;
    }
}

void adjustNapiExternalMemorySubtract(Napi::Env env, uint64_t size) {
    const uint64_t chunkSize = std::numeric_limits<int64_t>::max();
    while (size > 0) {
        int64_t adjustSize = std::min(size, chunkSize);
        Napi::MemoryManagement::AdjustExternalMemory(env, -adjustSize);
        size -= adjustSize;
    }
}
