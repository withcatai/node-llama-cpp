#include <iostream>

#include "addonGlobals.h"
#include "AddonModelData.h"
#include "AddonModelLora.h"

AddonModelData::AddonModelData() {

}
AddonModelData::~AddonModelData() {
    std::set<AddonModelLora *> currentLoraAdapters;
    currentLoraAdapters.swap(loraAdapters);

    for (auto lora : currentLoraAdapters) {
        lora->dispose(true);
    }
    currentLoraAdapters.clear();
}

void AddonModelData::removeLora(AddonModelLora* lora) {
    auto pos = loraAdapters.find(lora);
    if (pos != loraAdapters.end()) {
        loraAdapters.erase(pos);
    }
}