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

    auto parsed_grammar = llama_grammar_init_impl(nullptr, grammarCode.c_str(), rootRuleName.c_str(), false, nullptr, 0, nullptr, 0);
    
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

Napi::Value AddonGrammar::isTextCompatible(const Napi::CallbackInfo& info) {
    const std::string testText = info[0].As<Napi::String>().Utf8Value();

    auto parsed_grammar = llama_grammar_init_impl(nullptr, grammarCode.c_str(), rootRuleName.c_str(), false, nullptr, 0, nullptr, 0);
    
    // will be empty if there are parse errors
    if (parsed_grammar == nullptr) {
        Napi::Error::New(info.Env(), "Failed to parse grammar").ThrowAsJavaScriptException();
        return Napi::Boolean::New(info.Env(), false);
    }

    const auto cpts = unicode_cpts_from_utf8(testText);
    llama_grammar_stacks & stacks_cur = llama_grammar_get_stacks(parsed_grammar);

    for (const auto & cpt : cpts) {
        llama_grammar_accept(parsed_grammar, cpt);

        if (stacks_cur.empty()) {
            // no stacks means that the grammar failed to match at this point
            llama_grammar_free_impl(parsed_grammar);
            return Napi::Boolean::New(info.Env(), false);
        }
    }

    for (const auto & stack : stacks_cur) {
        if (stack.empty()) {
            // an empty stack means that the grammar has been completed
            llama_grammar_free_impl(parsed_grammar);
            return Napi::Boolean::New(info.Env(), true);
        }
    }

    llama_grammar_free_impl(parsed_grammar);
    return Napi::Boolean::New(info.Env(), false);
}

void AddonGrammar::init(Napi::Object exports) {
    exports.Set(
        "AddonGrammar",
        DefineClass(
            exports.Env(),
            "AddonGrammar",
            {
                InstanceMethod("isTextCompatible", &AddonGrammar::isTextCompatible),
            }
        )
    );
}