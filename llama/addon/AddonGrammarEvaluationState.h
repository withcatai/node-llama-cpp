#pragma once
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"

class AddonGrammarEvaluationState : public Napi::ObjectWrap<AddonGrammarEvaluationState> {
    public:
        AddonGrammar* grammarDef;
        llama_grammar* grammar = nullptr;

        AddonGrammarEvaluationState(const Napi::CallbackInfo& info);
        ~AddonGrammarEvaluationState();

        static void init(Napi::Object exports);
};