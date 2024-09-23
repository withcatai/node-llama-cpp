#pragma once
#include <set>
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"

class AddonModelData {
    public:
        std::set<AddonModelLora *> loraAdapters;

        AddonModelData();
        ~AddonModelData();

        void removeLora(AddonModelLora* lora);
};