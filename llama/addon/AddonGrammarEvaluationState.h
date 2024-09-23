#pragma once
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"
#include "AddonModel.h"

class AddonGrammarEvaluationState : public Napi::ObjectWrap<AddonGrammarEvaluationState> {
    public:
        AddonModel* model;
        AddonGrammar* grammarDef;
        llama_sampler * sampler = nullptr;

        AddonGrammarEvaluationState(const Napi::CallbackInfo& info);
        ~AddonGrammarEvaluationState();

        static void init(Napi::Object exports);
};