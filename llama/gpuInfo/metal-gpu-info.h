#pragma once

#include <stdint.h>
#include <string>
#include <vector>

void getMetalGpuInfo(uint64_t * total, uint64_t * used);
void getMetalGpuDeviceNames(std::vector<std::string> * deviceNames);