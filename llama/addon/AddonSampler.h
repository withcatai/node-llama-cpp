#pragma once
#include "llama.h"
#include "napi.h"
#include "RingBuffer.h"
#include "addonGlobals.h"
#include "AddonModel.h"

class AddonSampler : public Napi::ObjectWrap<AddonSampler> {
    public:
        AddonModel* model;
        llama_sampler * chain = nullptr;

        llama_sampler * temperatureSampler = nullptr;
        bool temperatureSampler_initialized = false;
        float temperatureSampler_temperature = 0.0f; // 0.0f = disabled

        llama_sampler * greedySampler = nullptr;

        llama_sampler * minPSampler = nullptr;
        float minPSampler_minP = 0.0f; // Min p sampling <=0.0f = disabled

        llama_sampler * topKSampler = nullptr;
        bool topKSampler_initialized = false;
        int topKSampler_topK = 0;

        llama_sampler * topPSampler = nullptr;
        float topPSampler_topP = 0.0f; // Top p sampling >=1.0 = disabled
        
        llama_sampler * seedSampler = nullptr;
        uint32_t seedSampler_seed = 0;

        llama_sampler * repeatPenaltySampler = nullptr;
        RingBuffer<llama_token> repeatPenalty_lastTokens = RingBuffer<llama_token>(64);
        int32_t repeatPenalty_maxTokens = 64;
        float repeatPenalty_penalty = 1.10f;  // 1.0 = disabled
        float repeatPenalty_presencePenalty = 0.00f;  // 0.0 = disabled
        float repeatPenalty_frequencyPenalty = 0.00f;  // 0.0 = disabled

        llama_sampler * tokenBiasSampler = nullptr;
        std::vector<llama_logit_bias> tokenBiasSampler_biases;

        AddonGrammarEvaluationState* grammarEvaluationState = nullptr;

        std::vector<llama_token_data> tokenCandidates;

        bool disposed = false;

        AddonSampler(const Napi::CallbackInfo& info);
        ~AddonSampler();

        void dispose();
        void freeChain();
        void rebuildChainIfNeeded();
        void acceptToken(llama_token token);

        Napi::Value Dispose(const Napi::CallbackInfo& info);
        Napi::Value ApplyConfig(const Napi::CallbackInfo& info);

        static Napi::Value AcceptGrammarEvaluationStateToken(const Napi::CallbackInfo& info);
        static Napi::Value CanBeNextTokenForGrammarEvaluationState(const Napi::CallbackInfo& info);

        static void init(Napi::Object exports);
};
