#pragma once
#include "llama.h"
#include "napi.h"
#include "addonGlobals.h"
#include "AddonSampler.h"

class AddonContext : public Napi::ObjectWrap<AddonContext> {
    public:
        AddonModel* model;
        llama_context_params context_params;
        llama_context* ctx;
        llama_batch batch;
        uint64_t batchMemorySize = 0;
        bool has_batch = false;
        int32_t batch_n_tokens = 0;
        int n_cur = 0;

        uint64_t loadedContextMemorySize = 0;
        bool contextLoaded = false;

        bool disposed = false;

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
        Napi::Value GetSequenceKvCacheMinPosition(const Napi::CallbackInfo& info);
        Napi::Value GetSequenceKvCacheMaxPosition(const Napi::CallbackInfo& info);
        Napi::Value DecodeBatch(const Napi::CallbackInfo& info);
        Napi::Value SampleToken(const Napi::CallbackInfo& info);

        Napi::Value GetEmbedding(const Napi::CallbackInfo& info);
        Napi::Value GetStateSize(const Napi::CallbackInfo& info);
        Napi::Value GetThreads(const Napi::CallbackInfo& info);
        Napi::Value SetThreads(const Napi::CallbackInfo& info);

        Napi::Value SaveSequenceStateToFile(const Napi::CallbackInfo& info);
        Napi::Value LoadSequenceStateFromFile(const Napi::CallbackInfo& info);

        Napi::Value PrintTimings(const Napi::CallbackInfo& info);
        Napi::Value EnsureDraftContextIsCompatibleForSpeculative(const Napi::CallbackInfo& info);

        Napi::Value SetLora(const Napi::CallbackInfo& info);

        static void init(Napi::Object exports);
};
