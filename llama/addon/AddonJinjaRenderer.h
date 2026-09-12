#pragma once

#include "napi.h"
#include "jinja/lexer.h"
#include "jinja/runtime.h"

#include <memory>
#include <optional>

class AddonJinjaRenderer : public Napi::ObjectWrap<AddonJinjaRenderer> {
    private:
        jinja::lexer_result lexerResult;
        std::shared_ptr<std::string> source;
        std::optional<jinja::program> program;

    public:
        AddonJinjaRenderer(const Napi::CallbackInfo& info);

        Napi::Value render(const Napi::CallbackInfo& info);

        static void init(Napi::Object exports);
};
