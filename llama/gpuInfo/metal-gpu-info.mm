#include <stdint.h>
#include <vector>
#include <string>
#import <Metal/Metal.h>

void getMetalGpuInfo(uint64_t * total, uint64_t * used) {
    id<MTLDevice> device = MTLCreateSystemDefaultDevice();

    if (device) {
        *total = device.recommendedMaxWorkingSetSize;
        *used = device.currentAllocatedSize;
    } else {
        *total = 0;
        *used = 0;
    }

    [device release];
    device = nil;
}

void getMetalGpuDeviceNames(std::vector<std::string> * deviceNames) {
    NSArray<id<MTLDevice>> *devices = MTLCopyAllDevices();

    for (id<MTLDevice> device in devices) {
        (*deviceNames).push_back(std::string(([NSString stringWithUTF8String:device.name.UTF8String]).UTF8String));
    }

    [devices release];
    devices = nil;
}
