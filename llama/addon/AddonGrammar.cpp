#include "addonGlobals.h"
#include "AddonGrammar.h"

AddonGrammar::AddonGrammar(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammar>(info) {
    grammarCode = info[0].As<Napi::String>().Utf8Value();

    if (info.Length() > 1 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();

        if (options.Has("addonExports")) {
            addonExportsRef = Napi::Persistent(options.Get("addonExports").As<Napi::Object>());
            hasAddonExportsRef = true;
        }

        if (options.Has("rootRuleName")) {
            rootRuleName = options.Get("rootRuleName").As<Napi::String>().Utf8Value();
        }
    }

    auto parsed_grammar = llama_grammar_init_impl(nullptr, grammarCode.c_str(), rootRuleName.c_str());
    
    // will be empty if there are parse errors
    if (parsed_grammar == nullptr) {
        Napi::Error::New(info.Env(), "Failed to parse grammar").ThrowAsJavaScriptException();
        return;
    }

    llama_grammar_free_impl(parsed_grammar);
}
AddonGrammar::~AddonGrammar() {
    if (hasAddonExportsRef) {
        addonExportsRef.Unref();
        hasAddonExportsRef = false;
    }
}

void AddonGrammar::init(Napi::Object exports) {
    exports.Set("AddonGrammar", DefineClass(exports.Env(), "AddonGrammar", {}));
}