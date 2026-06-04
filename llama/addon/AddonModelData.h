#pragma once
#include <set>
#include <vector>
#include <mutex>
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"

class AddonModelData {
    public:
        std::mutex loraAdaptersMutex;
        std::set<AddonModelLora *> loraAdapters;
        std::vector<AddonModelLora *> pendingFinalization;

        AddonModelData();
        ~AddonModelData();

        void addLora(AddonModelLora* lora);
        void removeLora(AddonModelLora* lora);
        void disposeMemory();
        void disposeMT();
};
