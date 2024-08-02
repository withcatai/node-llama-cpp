#include "addonGlobals.h"
#include "AddonGrammar.h"

AddonGrammar::AddonGrammar(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammar>(info) {
    // Get the model path
    std::string grammarCode = info[0].As<Napi::String>().Utf8Value();
    bool should_print_grammar = false;

    if (info.Length() > 1 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();

        if (options.Has("addonExports")) {
            addonExportsRef = Napi::Persistent(options.Get("addonExports").As<Napi::Object>());
            hasAddonExportsRef = true;
        }

        if (options.Has("debugPrintGrammar")) {
            should_print_grammar = options.Get("debugPrintGrammar").As<Napi::Boolean>().Value();
        }
    }

    parsed_grammar = grammar_parser::parse(grammarCode.c_str());
    // will be empty (default) if there are parse errors
    if (parsed_grammar.rules.empty()) {
        Napi::Error::New(info.Env(), "Failed to parse grammar").ThrowAsJavaScriptException();
        return;
    }

    if (should_print_grammar) {
        grammar_parser::print_grammar(stderr, parsed_grammar);
    }
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