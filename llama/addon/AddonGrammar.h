#pragma once
#include "llama.h"
#include "common.h"
#include "common/grammar-parser.h"
#include "napi.h"
#include "addonGlobals.h"

class AddonGrammar : public Napi::ObjectWrap<AddonGrammar> {
    public:
        grammar_parser::parse_state parsed_grammar;
        Napi::Reference<Napi::Object> addonExportsRef;
        bool hasAddonExportsRef = false;

        AddonGrammar(const Napi::CallbackInfo& info);
        ~AddonGrammar();

        static void init(Napi::Object exports);
};