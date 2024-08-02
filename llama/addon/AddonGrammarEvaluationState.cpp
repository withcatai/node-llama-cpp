#include <sstream>
#include "addonGlobals.h"
#include "common.h"
#include "llama.h"
#include "AddonGrammarEvaluationState.h"
#include "AddonGrammar.h"

AddonGrammarEvaluationState::AddonGrammarEvaluationState(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammarEvaluationState>(info) {
    grammarDef = Napi::ObjectWrap<AddonGrammar>::Unwrap(info[0].As<Napi::Object>());
    grammarDef->Ref();

    std::vector<const llama_grammar_element*> grammar_rules(grammarDef->parsed_grammar.c_rules());
    grammar = llama_grammar_init(grammar_rules.data(), grammar_rules.size(), grammarDef->parsed_grammar.symbol_ids.at("root"));
}
AddonGrammarEvaluationState::~AddonGrammarEvaluationState() {
    grammarDef->Unref();

    if (grammar != nullptr) {
        llama_grammar_free(grammar);
        grammar = nullptr;
    }
}

void AddonGrammarEvaluationState::init(Napi::Object exports) {
    exports.Set("AddonGrammarEvaluationState", DefineClass(exports.Env(), "AddonGrammarEvaluationState", {}));
}