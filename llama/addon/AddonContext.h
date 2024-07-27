#pragma once
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"

class AddonContext : public Napi::ObjectWrap<AddonContext> {
    public:
        AddonModel* model;
        llama_context_params context_params;
        llama_context* ctx;
        llama_batch batch;
        uint64_t batchMemorySize;
        bool has_batch;
        int32_t batch_n_tokens;
        int n_cur;

        uint64_t loadedContextMemorySize;
        bool contextLoaded;

        bool disposed;

        AddonContext(const Napi::CallbackInfo& info);
        ~AddonContext();

        void dispose();
        void disposeBatch();

        Napi::Value Init(const Napi::CallbackInfo& info);
        Napi::Value Dispose(const Napi::CallbackInfo& info);

        Napi::Value GetContextSize(const Napi::CallbackInfo& info);
        Napi::Value InitBatch(const Napi::CallbackInfo& info);
        Napi::Value DisposeBatch(const Napi::CallbackInfo& info);
        Napi::Value AddToBatch(const Napi::CallbackInfo& info);
        Napi::Value DisposeSequence(const Napi::CallbackInfo& info);
        Napi::Value RemoveTokenCellsFromSequence(const Napi::CallbackInfo& info);
        Napi::Value ShiftSequenceTokenCells(const Napi::CallbackInfo& info);
        Napi::Value DecodeBatch(const Napi::CallbackInfo& info);
        Napi::Value SampleToken(const Napi::CallbackInfo& info);

        Napi::Value AcceptGrammarEvaluationStateToken(const Napi::CallbackInfo& info);

        Napi::Value CanBeNextTokenForGrammarEvaluationState(const Napi::CallbackInfo& info);

        Napi::Value GetEmbedding(const Napi::CallbackInfo& info);
        Napi::Value GetStateSize(const Napi::CallbackInfo& info);

        Napi::Value PrintTimings(const Napi::CallbackInfo& info);

        Napi::Value SetLora(const Napi::CallbackInfo& info);

        static void init(Napi::Object exports);
};