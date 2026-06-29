#include "addonEnv.h"

#include <cstdlib>
#include <string>

#ifdef _WIN32
#include <errno.h>
#else
#include <cerrno>
#endif


Napi::Value addonSetEnv(const Napi::CallbackInfo& info) {
    const std::string varName = info[0].As<Napi::String>().Utf8Value();
    
    const bool shouldUnset = info.Length() == 1 || (
        info.Length() > 1 && (
            info[1].IsUndefined() ||
            info[1].IsNull() ||
            (info[1].IsString() && info[1].As<Napi::String>().Utf8Value().empty())
        )
    );
    if (shouldUnset) {
#ifdef _WIN32
        if (_putenv_s(varName.c_str(), "") != 0) {
            return Napi::Boolean::New(info.Env(), false);
        }
#else
        if (unsetenv(varName.c_str()) != 0) {
            return Napi::Boolean::New(info.Env(), false);
        }
#endif
    } else {
        const std::string varValue = info[1].As<Napi::String>().Utf8Value();
        const bool overwrite = info.Length() > 2 && info[2].IsBoolean() ? info[2].As<Napi::Boolean>().Value() : true;
    
#ifdef _WIN32
    if (_putenv_s(varName.c_str(), varValue.c_str()) != 0) {
        return Napi::Boolean::New(info.Env(), false);
    }
#else
    if (setenv(varName.c_str(), varValue.c_str(), overwrite ? 1 : 0) != 0) {
        return Napi::Boolean::New(info.Env(), false);
    }
#endif
    }

    return Napi::Boolean::New(info.Env(), true);
}
