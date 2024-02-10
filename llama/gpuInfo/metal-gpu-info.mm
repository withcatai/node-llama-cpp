#include <stdint.h>
#import <Metal/Metal.h>

void get_metal_gpu_info(uint64_t * total, uint64_t * used) {
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
