#include <algorithm>

#include "addonGlobals.h"
#include "AddonModelData.h"
#include "AddonModelLora.h"

AddonModelData::AddonModelData() {

}
AddonModelData::~AddonModelData() {
    disposeMT();
}

void AddonModelData::addLora(AddonModelLora* lora) {
    std::lock_guard<std::mutex> lock(loraAdaptersMutex);
    loraAdapters.insert(lora);
}

void AddonModelData::removeLora(AddonModelLora* lora) {
    std::lock_guard<std::mutex> lock(loraAdaptersMutex);
    auto pos = loraAdapters.find(lora);
    if (pos != loraAdapters.end()) {
        loraAdapters.erase(pos);
    }

    pendingFinalization.erase(
        std::remove(pendingFinalization.begin(), pendingFinalization.end(), lora),
        pendingFinalization.end()
    );
}

void AddonModelData::disposeMemory() {
    std::vector<AddonModelLora *> currentLoraAdapters;

    {
        std::lock_guard<std::mutex> lock(loraAdaptersMutex);
        currentLoraAdapters.reserve(loraAdapters.size());
        pendingFinalization.reserve(pendingFinalization.size() + loraAdapters.size());

            for (auto* lora : loraAdapters) {
            currentLoraAdapters.push_back(lora);
            pendingFinalization.push_back(lora);
        }

        loraAdapters.clear();
    }

    for (auto* lora : currentLoraAdapters) {
        lora->disposeMemory();
    }
}

void AddonModelData::disposeMT() {
    std::vector<AddonModelLora *> currentPendingFinalization;

    disposeMemory();

    {
        std::lock_guard<std::mutex> lock(loraAdaptersMutex);
        currentPendingFinalization.swap(pendingFinalization);
    }

    for (auto* lora : currentPendingFinalization) {
        lora->disposeMT(true);
    }
}
