#pragma once
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"
#include "globals/addonProgress.h"

class AddonModel : public Napi::ObjectWrap<AddonModel> {
    public:
        llama_model_params model_params;
        std::vector<llama_model_kv_override> kv_overrides;
        llama_model* model;
        const llama_vocab* vocab;
        uint64_t loadedModelSize = 0;
        Napi::Reference<Napi::Object> addonExportsRef;
        bool hasAddonExportsRef = false;
        AddonModelData* data;

        std::string modelPath;
        bool modelLoaded = false;
        bool abortModelLoad = false;
        bool model_load_stopped = false;
        float rawModelLoadPercentage = 0;
        unsigned modelLoadPercentage = 0;
        AddonThreadSafeProgressEventCallbackFunction addonThreadSafeOnLoadProgressEventCallback;
        bool onLoadProgressEventCallbackSet = false;
        bool hasLoadAbortSignal = false;

        bool disposed = false;

        AddonModel(const Napi::CallbackInfo& info);
        ~AddonModel();
        void dispose();

        Napi::Value Init(const Napi::CallbackInfo& info);
        Napi::Value LoadLora(const Napi::CallbackInfo& info);
        Napi::Value AbortActiveModelLoad(const Napi::CallbackInfo& info);
        Napi::Value Dispose(const Napi::CallbackInfo& info);
        Napi::Value Tokenize(const Napi::CallbackInfo& info);
        Napi::Value Detokenize(const Napi::CallbackInfo& info);
        Napi::Value GetTrainContextSize(const Napi::CallbackInfo& info);
        Napi::Value GetEmbeddingVectorSize(const Napi::CallbackInfo& info);
        Napi::Value GetTotalSize(const Napi::CallbackInfo& info);
        Napi::Value GetTotalParameters(const Napi::CallbackInfo& info);
        Napi::Value GetModelDescription(const Napi::CallbackInfo& info);

        Napi::Value TokenBos(const Napi::CallbackInfo& info);
        Napi::Value TokenEos(const Napi::CallbackInfo& info);
        Napi::Value TokenNl(const Napi::CallbackInfo& info);
        Napi::Value PrefixToken(const Napi::CallbackInfo& info);
        Napi::Value MiddleToken(const Napi::CallbackInfo& info);
        Napi::Value SuffixToken(const Napi::CallbackInfo& info);
        Napi::Value EotToken(const Napi::CallbackInfo& info);
        Napi::Value SepToken(const Napi::CallbackInfo& info);
        Napi::Value GetTokenString(const Napi::CallbackInfo& info);

        Napi::Value GetTokenAttributes(const Napi::CallbackInfo& info);
        Napi::Value IsEogToken(const Napi::CallbackInfo& info);
        Napi::Value GetVocabularyType(const Napi::CallbackInfo& info);
        Napi::Value ShouldPrependBosToken(const Napi::CallbackInfo& info);
        Napi::Value ShouldAppendEosToken(const Napi::CallbackInfo& info);
        Napi::Value GetModelSize(const Napi::CallbackInfo& info);

        static void init(Napi::Object exports);
};
