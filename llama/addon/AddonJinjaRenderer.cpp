#include "AddonJinjaRenderer.h"
#include "jinja/parser.h"

#include <cmath>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
    Napi::Array ownEnumerableKeys(const Napi::Object& object) {
        napi_value keys;
        const auto status = napi_get_all_property_names(object.Env(), object, napi_key_own_only,
            static_cast<napi_key_filter>(napi_key_enumerable | napi_key_skip_symbols), napi_key_numbers_to_strings, &keys);
        if (status != napi_ok) {
            throw Napi::Error::New(object.Env());
        }
        return Napi::Array(object.Env(), keys);
    }

    struct InputConverter {
        std::string errorPath;

        jinja::value convert(const Napi::Value& value, size_t depth = 0) {
            if (depth > 256) {
                throw std::invalid_argument("Template input is too deeply nested or contains a cycle");
            }
            if (value.IsUndefined()) {
                return jinja::mk_val<jinja::value_undefined>();
            } else if (value.IsNull()) {
                return jinja::mk_val<jinja::value_none>();
            } else if (value.IsBoolean()) {
                return jinja::mk_val<jinja::value_bool>(value.As<Napi::Boolean>().Value());
            } else if (value.IsString()) {
                auto result = jinja::mk_val<jinja::value_string>();
                result->val_str.parts.push_back({false, value.As<Napi::String>().Utf8Value()});
                return result;
            } else if (value.IsNumber()) {
                const double number = value.As<Napi::Number>().DoubleValue();
                constexpr double minInteger = static_cast<double>(std::numeric_limits<int64_t>::min());
                if (!std::isfinite(number) || number < minInteger || number >= -minInteger) {
                    throw std::invalid_argument("Number is outside the native Jinja numeric range");
                }
                if (std::trunc(number) == number) {
                    return jinja::mk_val<jinja::value_int>(static_cast<int64_t>(number));
                }
                return jinja::mk_val<jinja::value_float>(number);
            } else if (!value.IsObject() || value.IsFunction()) {
                throw std::runtime_error("Unsupported JavaScript value; expected a string, number, boolean, null, undefined, array or object");
            }

            jinja::value result;
            if (value.IsArray()) {
                const auto array = value.As<Napi::Array>();
                const auto length = array.Length();
                auto converted = jinja::mk_val<jinja::value_array>();
                converted->val_arr.reserve(length);
                for (uint32_t i = 0; i < length; i++) {
                    Napi::HandleScope scope(value.Env());
                    try {
                        converted->push_back(convert(array.Get(i), depth + 1));
                    } catch (...) {
                        errorPath.insert(0, "[" + std::to_string(i) + "]");
                        throw;
                    }
                }
                result = std::move(converted);
            } else {
                const auto object = value.As<Napi::Object>();
                const auto keys = ownEnumerableKeys(object);
                const auto length = keys.Length();
                auto converted = jinja::mk_val<jinja::value_object>();
                converted->val_obj.reserve(length);
                converted->unordered.reserve(length);
                for (uint32_t i = 0; i < length; i++) {
                    Napi::HandleScope scope(value.Env());
                    const auto key = keys.Get(i).As<Napi::String>();
                    const auto name = key.Utf8Value();
                    try {
                        converted->insert(name, convert(object.Get(key), depth + 1));
                    } catch (...) {
                        errorPath.insert(0, "[\"" + name + "\"]");
                        throw;
                    }
                }
                result = std::move(converted);
            }
            return result;
        }
    };

    // like gather_string_parts_recursive() from llama/llama.cpp/common/jinja/runtime.h but without copying arrays or string parts
    void appendResult(const jinja::value& value, std::string& output) {
        if (jinja::is_val<jinja::value_string>(value)) {
            for (const auto& part : value->val_str.parts) {
                output.append(part.val);
            }
        } else if (jinja::is_val<jinja::value_array>(value)) {
            for (const auto& item : value->as_array()) {
                appendResult(item, output);
            }
        } else if (jinja::is_val<jinja::value_int>(value) || jinja::is_val<jinja::value_float>(value) ||
                   jinja::is_val<jinja::value_bool>(value)) {
            output.append(value->as_string().str());
        }
    }

    void throwError(Napi::Env env, const std::string& message, const std::exception& error) {
        auto result = Napi::Error::New(env, "AddonJinjaRenderer: " + message + ": " + error.what());
        const auto* jsError = dynamic_cast<const Napi::Error*>(&error);
        if (jsError != nullptr) {
            result.Set("cause", jsError->Value());
        }
        result.ThrowAsJavaScriptException();
    }
}

AddonJinjaRenderer::AddonJinjaRenderer(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonJinjaRenderer>(info) {
    try {
        if (info.Length() != 1 || !info[0].IsString()) {
            throw std::invalid_argument("Constructor expects a template string");
        }
        auto text = info[0].As<Napi::String>().Utf8Value();
        lexerResult = jinja::lexer().tokenize(text);
        program.emplace(jinja::parse_from_tokens(lexerResult));
        source = std::make_shared<std::string>(std::move(text));
    } catch (const std::exception& error) {
        throwError(info.Env(), "failed to compile template", error);
    } catch (...) {
        Napi::Error::New(info.Env(), "AddonJinjaRenderer: unknown error compiling template").ThrowAsJavaScriptException();
    }
}

Napi::Value AddonJinjaRenderer::render(const Napi::CallbackInfo& info) {
    if (source.get() == nullptr) {
        Napi::Error::New(info.Env(), "AddonJinjaRenderer: failed to render template: Renderer is not initialized").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    InputConverter converter;
    jinja::value input;
    try {
        if (info.Length() > 1 || (info.Length() == 1 && !info[0].IsUndefined() &&
            (!info[0].IsObject() || info[0].IsArray() || info[0].IsFunction()))) {
            throw std::invalid_argument("render expects an optional object of template variables");
        }
        if (info.Length() == 1 && !info[0].IsUndefined()) {
            input = converter.convert(info[0]);
        }
    } catch (const std::exception& error) {
        throwError(info.Env(), "failed to convert input at items" + converter.errorPath, error);
        return info.Env().Undefined();
    } catch (...) {
        Napi::Error::New(info.Env(), "AddonJinjaRenderer: failed to convert input at items" + converter.errorPath + ": unknown native error").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    try {
        jinja::context context;
        context.src = source;
        if (input.get() != nullptr) {
            for (const auto& item : input->as_ordered_object()) {
                context.set_val(item.first, item.second);
            }
            input.reset();
        }

        if (!program.has_value()) {
            program.emplace(jinja::parse_from_tokens(lexerResult));
        }

        jinja::runtime runtime(context);
        const auto result = runtime.execute(*program);
        std::string output;
        appendResult(result, output);
        return Napi::String::New(info.Env(), output);
    } catch (const std::exception& error) {
        // upstream filter blocks can move AST nodes before throwing
        program.reset();
        throwError(info.Env(), "failed to render template", error);
    } catch (...) {
        program.reset();
        Napi::Error::New(info.Env(), "AddonJinjaRenderer: failed to render template: unknown native error").ThrowAsJavaScriptException();
    }
    return info.Env().Undefined();
}

void AddonJinjaRenderer::init(Napi::Object exports) {
    exports.Set("AddonJinjaRenderer", DefineClass(exports.Env(), "AddonJinjaRenderer", {
        InstanceMethod("render", &AddonJinjaRenderer::render)
    }));
}
