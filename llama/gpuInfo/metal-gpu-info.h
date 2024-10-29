#pragma once

#include <stdint.h>
#include <string>
#include <vector>

void getMetalGpuInfo(uint64_t * total, uint64_t * used, uint64_t * unifiedMemorySize);
void getMetalGpuDeviceNames(std::vector<std::string> * deviceNames);