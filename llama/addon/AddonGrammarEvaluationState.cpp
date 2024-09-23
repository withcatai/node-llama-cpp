#include <sstream>
#include "addonGlobals.h"
#include "common/common.h"
#include "llama.h"
#include "AddonGrammarEvaluationState.h"
#include "AddonGrammar.h"

AddonGrammarEvaluationState::AddonGrammarEvaluationState(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammarEvaluationState>(info) {
    model = Napi::ObjectWrap<AddonModel>::Unwrap(info[0].As<Napi::Object>());
    model->Ref();

    grammarDef = Napi::ObjectWrap<AddonGrammar>::Unwrap(info[1].As<Napi::Object>());
    grammarDef->Ref();

    sampler = llama_sampler_init_grammar(model->model, grammarDef->grammarCode.c_str(), grammarDef->rootRuleName.c_str());
}
AddonGrammarEvaluationState::~AddonGrammarEvaluationState() {
    llama_sampler_free(sampler);
    grammarDef->Unref();
    model->Unref();
}

void AddonGrammarEvaluationState::init(Napi::Object exports) {
    exports.Set("AddonGrammarEvaluationState", DefineClass(exports.Env(), "AddonGrammarEvaluationState", {}));
}
