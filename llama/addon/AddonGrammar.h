#pragma once
#include "llama.h"
#include "common/common.h"
#include "llama-grammar.h"
#include "napi.h"
#include "addonGlobals.h"

class AddonGrammar : public Napi::ObjectWrap<AddonGrammar> {
    public:
        std::string grammarCode = "";
        std::string rootRuleName = "root";
        Napi::Reference<Napi::Object> addonExportsRef;
        bool hasAddonExportsRef = false;

        AddonGrammar(const Napi::CallbackInfo& info);
        ~AddonGrammar();

        static void init(Napi::Object exports);
};