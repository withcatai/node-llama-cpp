#include <thread>
#include <algorithm>
#include "common.h"
#include "llama.h"

#include "addonGlobals.h"
#include "AddonModel.h"
#include "AddonModelLora.h"
#include "AddonGrammarEvaluationState.h"
#include "AddonContext.h"

static uint64_t calculateBatchMemorySize(int32_t n_tokens_alloc, int32_t embd, int32_t n_seq_max) {
    uint64_t totalSize = 0;

    if (embd) {
        totalSize += sizeof(float) * n_tokens_alloc * embd;
    } else {
        totalSize += sizeof(llama_token) * n_tokens_alloc;
    }

    totalSize += sizeof(llama_pos) * n_tokens_alloc;
    totalSize += sizeof(int32_t) * n_tokens_alloc;
    totalSize += sizeof(llama_seq_id *) * (n_tokens_alloc + 1);

    totalSize += sizeof(llama_seq_id) * n_seq_max * n_tokens_alloc;

    totalSize += sizeof(int8_t) * n_tokens_alloc;

    return totalSize;
}

class AddonContextDecodeBatchWorker : public Napi::AsyncWorker {
    public:
        AddonContext* ctx;

        AddonContextDecodeBatchWorker(const Napi::Env& env, AddonContext* ctx)
            : Napi::AsyncWorker(env, "AddonContextDecodeBatchWorker"),
              ctx(ctx),
              deferred(Napi::Promise::Deferred::New(env)) {
            ctx->Ref();
        }
        ~AddonContextDecodeBatchWorker() {
            ctx->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                // Perform the evaluation using llama_decode.
                int r = llama_decode(ctx->ctx, ctx->batch);

                if (r != 0) {
                    if (r == 1) {
                        SetError("could not find a KV slot for the batch (try reducing the size of the batch or increase the context)");
                    } else {
                        SetError("Eval has failed");
                    }

                    return;
                }

                llama_synchronize(ctx->ctx);
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_decode\"");
            }
        }
        void OnOK() {
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

class AddonContextLoadContextWorker : public Napi::AsyncWorker {
    public:
        AddonContext* context;

        AddonContextLoadContextWorker(const Napi::Env& env, AddonContext* context)
            : Napi::AsyncWorker(env, "AddonContextLoadContextWorker"),
              context(context),
              deferred(Napi::Promise::Deferred::New(env)) {
            context->Ref();
        }
        ~AddonContextLoadContextWorker() {
            context->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                context->ctx = llama_new_context_with_model(context->model->model, context->context_params);

                context->contextLoaded = context->ctx != nullptr && context->ctx != NULL;
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_new_context_with_model\"");
            }
        }
        void OnOK() {
            if (context->contextLoaded) {
                uint64_t contextMemorySize = llama_state_get_size(context->ctx);
                adjustNapiExternalMemoryAdd(Env(), contextMemorySize);
                context->loadedContextMemorySize = contextMemorySize;
            }

            deferred.Resolve(Napi::Boolean::New(Env(), context->contextLoaded));
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};
class AddonContextUnloadContextWorker : public Napi::AsyncWorker {
    public:
        AddonContext* context;

        AddonContextUnloadContextWorker(const Napi::Env& env, AddonContext* context)
            : Napi::AsyncWorker(env, "AddonContextUnloadContextWorker"),
              context(context),
              deferred(Napi::Promise::Deferred::New(env)) {
            context->Ref();
        }
        ~AddonContextUnloadContextWorker() {
            context->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                llama_free(context->ctx);
                context->contextLoaded = false;

                try {
                    if (context->has_batch) {
                        llama_batch_free(context->batch);
                        context->has_batch = false;
                        context->batch_n_tokens = 0;
                    }

                    context->dispose();
                } catch (const std::exception& e) {
                    SetError(e.what());
                } catch(...) {
                    SetError("Unknown error when calling \"llama_batch_free\"");
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"llama_free\"");
            }
        }
        void OnOK() {
            adjustNapiExternalMemorySubtract(Env(), context->loadedContextMemorySize);
            context->loadedContextMemorySize = 0;

            adjustNapiExternalMemorySubtract(Env(), context->batchMemorySize);
            context->batchMemorySize = 0;

            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};


class AddonContextSampleTokenWorker : public Napi::AsyncWorker {
    public:
        AddonContext* ctx;
        AddonGrammarEvaluationState* grammar_evaluation_state;
        int32_t batchLogitIndex;
        bool use_grammar = false;
        llama_token result;
        float temperature = 0.0f;
        float min_p = 0;
        int32_t top_k = 40;
        float top_p = 0.95f;
        float repeat_penalty = 1.10f;  // 1.0 = disabled
        float repeat_penalty_presence_penalty = 0.00f;  // 0.0 = disabled
        float repeat_penalty_frequency_penalty = 0.00f;  // 0.0 = disabled
        std::vector<llama_token> repeat_penalty_tokens;
        std::unordered_map<llama_token, float> tokenBiases;
        bool useTokenBiases = false;
        bool use_repeat_penalty = false;

        AddonContextSampleTokenWorker(const Napi::CallbackInfo& info, AddonContext* ctx)
            : Napi::AsyncWorker(info.Env(), "AddonContextSampleTokenWorker"),
              ctx(ctx),
              deferred(Napi::Promise::Deferred::New(info.Env())) {
            ctx->Ref();

            batchLogitIndex = info[0].As<Napi::Number>().Int32Value();

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("temperature")) {
                    temperature = options.Get("temperature").As<Napi::Number>().FloatValue();
                }

                if (options.Has("minP")) {
                    min_p = options.Get("minP").As<Napi::Number>().FloatValue();
                }

                if (options.Has("topK")) {
                    top_k = options.Get("topK").As<Napi::Number>().Int32Value();
                }

                if (options.Has("topP")) {
                    top_p = options.Get("topP").As<Napi::Number>().FloatValue();
                }

                if (options.Has("repeatPenalty")) {
                    repeat_penalty = options.Get("repeatPenalty").As<Napi::Number>().FloatValue();
                }

                if (options.Has("repeatPenaltyTokens")) {
                    Napi::Uint32Array repeat_penalty_tokens_uint32_array = options.Get("repeatPenaltyTokens").As<Napi::Uint32Array>();

                    repeat_penalty_tokens.reserve(repeat_penalty_tokens_uint32_array.ElementLength());
                    for (size_t i = 0; i < repeat_penalty_tokens_uint32_array.ElementLength(); i++) {
                        repeat_penalty_tokens.push_back(static_cast<llama_token>(repeat_penalty_tokens_uint32_array[i]));
                    }

                    use_repeat_penalty = true;
                }

                if (options.Has("tokenBiasKeys") && options.Has("tokenBiasValues")) {
                    Napi::Uint32Array tokenBiasKeys = options.Get("tokenBiasKeys").As<Napi::Uint32Array>();
                    Napi::Float32Array tokenBiasValues = options.Get("tokenBiasValues").As<Napi::Float32Array>();

                    if (tokenBiasKeys.ElementLength() == tokenBiasValues.ElementLength()) {
                        for (size_t i = 0; i < tokenBiasKeys.ElementLength(); i++) {
                            tokenBiases[static_cast<llama_token>(tokenBiasKeys[i])] = tokenBiasValues[i];
                        }

                        useTokenBiases = true;
                    }
                }

                if (options.Has("repeatPenaltyPresencePenalty")) {
                    repeat_penalty_presence_penalty = options.Get("repeatPenaltyPresencePenalty").As<Napi::Number>().FloatValue();
                }

                if (options.Has("repeatPenaltyFrequencyPenalty")) {
                    repeat_penalty_frequency_penalty = options.Get("repeatPenaltyFrequencyPenalty").As<Napi::Number>().FloatValue();
                }

                if (options.Has("grammarEvaluationState")) {
                    grammar_evaluation_state =
                        Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(options.Get("grammarEvaluationState").As<Napi::Object>());
                    grammar_evaluation_state->Ref();
                    use_grammar = true;
                }
            }
        }
        ~AddonContextSampleTokenWorker() {
            ctx->Unref();

            if (use_grammar) {
                grammar_evaluation_state->Unref();
                use_grammar = false;
            }
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                SampleToken();
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch(...) {
                SetError("Unknown error when calling \"SampleToken\"");
            }
        }

        void SampleToken() {
            llama_token new_token_id = 0;

            // Select the best prediction.
            if (llama_get_logits(ctx->ctx) == nullptr) {
                SetError("This model does not support token generation");
                return;
            }

            auto logits = llama_get_logits_ith(ctx->ctx, batchLogitIndex);
            auto n_vocab = llama_n_vocab(ctx->model->model);

            std::vector<llama_token_data> candidates;
            candidates.reserve(n_vocab);

            for (llama_token token_id = 0; token_id < n_vocab; token_id++) {
                auto logit = logits[token_id];

                if (useTokenBiases) {
                    bool hasTokenBias = tokenBiases.find(token_id) != tokenBiases.end();
                    if (hasTokenBias) {
                        auto logitBias = tokenBiases.at(token_id);
                        if (logitBias == -INFINITY || logitBias < -INFINITY) {
                            if (!llama_token_is_eog(ctx->model->model, token_id)) {
                                logit = -INFINITY;
                            }
                        } else {
                            logit += logitBias;
                        }
                    }
                }

                candidates.emplace_back(llama_token_data { token_id, logit, 0.0f });
            }

            llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

            if (use_repeat_penalty && !repeat_penalty_tokens.empty()) {
                llama_sample_repetition_penalties(
                    ctx->ctx,
                    &candidates_p,
                    repeat_penalty_tokens.data(),
                    repeat_penalty_tokens.size(),
                    repeat_penalty,
                    repeat_penalty_frequency_penalty,
                    repeat_penalty_presence_penalty
                );
            }

            if (use_grammar && (grammar_evaluation_state)->grammar != nullptr) {
                llama_grammar_sample((grammar_evaluation_state)->grammar, ctx->ctx, &candidates_p);

                if ((candidates_p.size == 0 || candidates_p.data[0].logit == -INFINITY) && useTokenBiases) {
                    // logit biases caused grammar sampling to fail, so sampling again without logit biases
                    useTokenBiases = false;
                    SampleToken();
                    return;
                }
            }

            if (temperature <= 0) {
                new_token_id = llama_sample_token_greedy(ctx->ctx, &candidates_p);
            } else {
                const int32_t resolved_top_k =
                    top_k <= 0 ? llama_n_vocab(ctx->model->model) : std::min(top_k, llama_n_vocab(ctx->model->model));
                const int32_t n_probs = 0;  // Number of probabilities to keep - 0 = disabled
                const float tfs_z = 1.00f;  // Tail free sampling - 1.0 = disabled
                const float typical_p = 1.00f;  // Typical probability - 1.0 = disabled
                const float resolved_top_p = top_p;  // Top p sampling - 1.0 = disabled

                // Temperature sampling
                size_t min_keep = std::max(1, n_probs);
                llama_sample_top_k(ctx->ctx, &candidates_p, resolved_top_k, min_keep);
                llama_sample_tail_free(ctx->ctx, &candidates_p, tfs_z, min_keep);
                llama_sample_typical(ctx->ctx, &candidates_p, typical_p, min_keep);
                llama_sample_top_p(ctx->ctx, &candidates_p, resolved_top_p, min_keep);
                llama_sample_min_p(ctx->ctx, &candidates_p, min_p, min_keep);
                llama_sample_temp(ctx->ctx, &candidates_p, temperature);
                new_token_id = llama_sample_token(ctx->ctx, &candidates_p);
            }

            if (!llama_token_is_eog(ctx->model->model, new_token_id) && use_grammar && (grammar_evaluation_state)->grammar != nullptr) {
                llama_grammar_accept_token((grammar_evaluation_state)->grammar, ctx->ctx, new_token_id);
            }

            result = new_token_id;
        }
        void OnOK() {
            Napi::Number resultValue = Napi::Number::New(Env(), static_cast<uint32_t>(result));
            deferred.Resolve(resultValue);
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

AddonContext::AddonContext(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonContext>(info) {
    model = Napi::ObjectWrap<AddonModel>::Unwrap(info[0].As<Napi::Object>());
    model->Ref();

    context_params = llama_context_default_params();
    context_params.seed = -1;
    context_params.n_ctx = 4096;
    context_params.n_threads = std::max(cpu_get_num_math(), 1);
    context_params.n_threads_batch = context_params.n_threads;

    if (info.Length() > 1 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();

        if (options.Has("noSeed")) {
            context_params.seed = time(NULL);
        } else if (options.Has("seed")) {
            context_params.seed = options.Get("seed").As<Napi::Number>().Uint32Value();
        }

        if (options.Has("contextSize")) {
            context_params.n_ctx = options.Get("contextSize").As<Napi::Number>().Uint32Value();
        }

        if (options.Has("batchSize")) {
            context_params.n_batch = options.Get("batchSize").As<Napi::Number>().Uint32Value();
            context_params.n_ubatch = context_params.n_batch; // the batch queue is managed in the JS side, so there's no need for managing it on the C++ side
        }

        if (options.Has("sequences")) {
            context_params.n_seq_max = options.Get("sequences").As<Napi::Number>().Uint32Value();
        }

        if (options.Has("embeddings")) {
            context_params.embeddings = options.Get("embeddings").As<Napi::Boolean>().Value();
        }

        if (options.Has("flashAttention")) {
            context_params.flash_attn = options.Get("flashAttention").As<Napi::Boolean>().Value();
        }

        if (options.Has("threads")) {
            const auto n_threads = options.Get("threads").As<Napi::Number>().Int32Value();
            const auto resolved_n_threads = n_threads == 0 ? std::max((int32_t)std::thread::hardware_concurrency(), context_params.n_threads) : n_threads;

            context_params.n_threads = resolved_n_threads;
            context_params.n_threads_batch = resolved_n_threads;
        }
    }
}
AddonContext::~AddonContext() {
    dispose();
}

void AddonContext::dispose() {
    if (disposed) {
        return;
    }

    disposed = true;
    if (contextLoaded) {
        contextLoaded = false;
        llama_free(ctx);

        adjustNapiExternalMemorySubtract(Env(), loadedContextMemorySize);
        loadedContextMemorySize = 0;
    }

    model->Unref();

    disposeBatch();
}
void AddonContext::disposeBatch() {
    if (!has_batch) {
        return;
    }

    llama_batch_free(batch);
    has_batch = false;
    batch_n_tokens = 0;

    adjustNapiExternalMemorySubtract(Env(), batchMemorySize);
    batchMemorySize = 0;
}

Napi::Value AddonContext::Init(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    AddonContextLoadContextWorker* worker = new AddonContextLoadContextWorker(this->Env(), this);
    worker->Queue();
    return worker->GetPromise();
}
Napi::Value AddonContext::Dispose(const Napi::CallbackInfo& info) {
    if (disposed) {
        return info.Env().Undefined();
    }

    if (contextLoaded) {
        contextLoaded = false;

        AddonContextUnloadContextWorker* worker = new AddonContextUnloadContextWorker(this->Env(), this);
        worker->Queue();
        return worker->GetPromise();
    } else {
        dispose();

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(info.Env());
        deferred.Resolve(info.Env().Undefined());
        return deferred.Promise();
    }
}

Napi::Value AddonContext::GetContextSize(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return Napi::Number::From(info.Env(), llama_n_ctx(ctx));
}
Napi::Value AddonContext::InitBatch(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    if (has_batch) {
        llama_batch_free(batch);
    }

    int32_t n_tokens = info[0].As<Napi::Number>().Int32Value();

    batch = llama_batch_init(n_tokens, 0, 1);
    has_batch = true;
    batch_n_tokens = n_tokens;

    uint64_t newBatchMemorySize = calculateBatchMemorySize(n_tokens, llama_n_embd(model->model), context_params.n_batch);
    if (newBatchMemorySize > batchMemorySize) {
        adjustNapiExternalMemoryAdd(Env(), newBatchMemorySize - batchMemorySize);
        batchMemorySize = newBatchMemorySize;
    } else if (newBatchMemorySize < batchMemorySize) {
        adjustNapiExternalMemorySubtract(Env(), batchMemorySize - newBatchMemorySize);
        batchMemorySize = newBatchMemorySize;
    }

    return info.Env().Undefined();
}
Napi::Value AddonContext::DisposeBatch(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    disposeBatch();

    return info.Env().Undefined();
}
Napi::Value AddonContext::AddToBatch(const Napi::CallbackInfo& info) {
    if (!has_batch) {
        Napi::Error::New(info.Env(), "No batch is initialized").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
    int32_t firstTokenContextIndex = info[1].As<Napi::Number>().Int32Value();
    Napi::Uint32Array tokens = info[2].As<Napi::Uint32Array>();
    bool generateLogitAtTheEnd = info[3].As<Napi::Boolean>().Value();

    auto tokensLength = tokens.ElementLength();
    GGML_ASSERT(batch.n_tokens + tokensLength <= batch_n_tokens);

    for (size_t i = 0; i < tokensLength; i++) {
        llama_batch_add(batch, static_cast<llama_token>(tokens[i]), firstTokenContextIndex + i, { sequenceId }, false);
    }

    if (generateLogitAtTheEnd) {
        batch.logits[batch.n_tokens - 1] = true;

        auto logit_index = batch.n_tokens - 1;

        return Napi::Number::From(info.Env(), logit_index);
    }

    return info.Env().Undefined();
}
Napi::Value AddonContext::DisposeSequence(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();

    bool result = llama_kv_cache_seq_rm(ctx, sequenceId, -1, -1);

    if (!result) {
        Napi::Error::New(info.Env(), "Failed to dispose sequence").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return info.Env().Undefined();
}
Napi::Value AddonContext::RemoveTokenCellsFromSequence(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
    int32_t startPos = info[1].As<Napi::Number>().Int32Value();
    int32_t endPos = info[2].As<Napi::Number>().Int32Value();

    bool result = llama_kv_cache_seq_rm(ctx, sequenceId, startPos, endPos);

    return Napi::Boolean::New(info.Env(), result);
}
Napi::Value AddonContext::ShiftSequenceTokenCells(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
    int32_t startPos = info[1].As<Napi::Number>().Int32Value();
    int32_t endPos = info[2].As<Napi::Number>().Int32Value();
    int32_t shiftDelta = info[3].As<Napi::Number>().Int32Value();

    llama_kv_cache_seq_add(ctx, sequenceId, startPos, endPos, shiftDelta);

    return info.Env().Undefined();
}
Napi::Value AddonContext::DecodeBatch(const Napi::CallbackInfo& info) {
    AddonContextDecodeBatchWorker* worker = new AddonContextDecodeBatchWorker(info.Env(), this);
    worker->Queue();
    return worker->GetPromise();
}
Napi::Value AddonContext::SampleToken(const Napi::CallbackInfo& info) {
    AddonContextSampleTokenWorker* worker = new AddonContextSampleTokenWorker(info, this);
    worker->Queue();
    return worker->GetPromise();
}

Napi::Value AddonContext::AcceptGrammarEvaluationStateToken(const Napi::CallbackInfo& info) {
    AddonGrammarEvaluationState* grammar_evaluation_state =
        Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(info[0].As<Napi::Object>());
    llama_token tokenId = info[1].As<Napi::Number>().Int32Value();

    if ((grammar_evaluation_state)->grammar != nullptr) {
        llama_grammar_accept_token((grammar_evaluation_state)->grammar, ctx, tokenId);
    }

    return info.Env().Undefined();
}

Napi::Value AddonContext::CanBeNextTokenForGrammarEvaluationState(const Napi::CallbackInfo& info) {
    AddonGrammarEvaluationState* grammar_evaluation_state =
        Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(info[0].As<Napi::Object>());
    llama_token tokenId = info[1].As<Napi::Number>().Int32Value();

    if ((grammar_evaluation_state)->grammar != nullptr) {
        std::vector<llama_token_data> candidates;
        candidates.reserve(1);
        candidates.emplace_back(llama_token_data { tokenId, 1, 0.0f });

        llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

        llama_grammar_sample((grammar_evaluation_state)->grammar, ctx, &candidates_p);

        if (candidates_p.size == 0 || candidates_p.data[0].logit == -INFINITY) {
            return Napi::Boolean::New(info.Env(), false);
        }

        return Napi::Boolean::New(info.Env(), true);
    }

    return Napi::Boolean::New(info.Env(), false);
}

Napi::Value AddonContext::GetEmbedding(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    int32_t inputTokensLength = info[0].As<Napi::Number>().Int32Value();

    if (inputTokensLength <= 0) {
        Napi::Error::New(info.Env(), "Invalid input tokens length").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    const int n_embd = llama_n_embd(model->model);
    const auto* embeddings = llama_get_embeddings_seq(ctx, 0);
    if (embeddings == NULL) {
        embeddings = llama_get_embeddings_ith(ctx, inputTokensLength - 1);

        if (embeddings == NULL) {
            Napi::Error::New(info.Env(), std::string("Failed to get embeddings for token ") + std::to_string(inputTokensLength - 1)).ThrowAsJavaScriptException();
            return info.Env().Undefined();
        }
    }

    Napi::Float64Array result = Napi::Float64Array::New(info.Env(), n_embd);
    for (size_t i = 0; i < n_embd; ++i) {
        result[i] = embeddings[i];
    }

    return result;
}

Napi::Value AddonContext::GetStateSize(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return Napi::Number::From(info.Env(), llama_state_get_size(ctx));
}

Napi::Value AddonContext::GetThreads(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    return Napi::Number::From(info.Env(), llama_n_threads(ctx));
}

Napi::Value AddonContext::PrintTimings(const Napi::CallbackInfo& info) {
    llama_print_timings(ctx);
    llama_reset_timings(ctx);
    return info.Env().Undefined();
}

Napi::Value AddonContext::SetLora(const Napi::CallbackInfo& info) {
    AddonModelLora* lora = Napi::ObjectWrap<AddonModelLora>::Unwrap(info[0].As<Napi::Object>());
    float scale = info[1].As<Napi::Number>().FloatValue();

    llama_lora_adapter_set(ctx, lora->lora_adapter, scale);

    return info.Env().Undefined();
}

void AddonContext::init(Napi::Object exports) {
    exports.Set(
        "AddonContext",
        DefineClass(
            exports.Env(),
            "AddonContext",
            {
                InstanceMethod("init", &AddonContext::Init),
                InstanceMethod("getContextSize", &AddonContext::GetContextSize),
                InstanceMethod("initBatch", &AddonContext::InitBatch),
                InstanceMethod("addToBatch", &AddonContext::AddToBatch),
                InstanceMethod("disposeSequence", &AddonContext::DisposeSequence),
                InstanceMethod("removeTokenCellsFromSequence", &AddonContext::RemoveTokenCellsFromSequence),
                InstanceMethod("shiftSequenceTokenCells", &AddonContext::ShiftSequenceTokenCells),
                InstanceMethod("decodeBatch", &AddonContext::DecodeBatch),
                InstanceMethod("sampleToken", &AddonContext::SampleToken),
                InstanceMethod("acceptGrammarEvaluationStateToken", &AddonContext::AcceptGrammarEvaluationStateToken),
                InstanceMethod("canBeNextTokenForGrammarEvaluationState", &AddonContext::CanBeNextTokenForGrammarEvaluationState),
                InstanceMethod("getEmbedding", &AddonContext::GetEmbedding),
                InstanceMethod("getStateSize", &AddonContext::GetStateSize),
                InstanceMethod("getThreads", &AddonContext::GetThreads),
                InstanceMethod("printTimings", &AddonContext::PrintTimings),
                InstanceMethod("setLora", &AddonContext::SetLora),
                InstanceMethod("dispose", &AddonContext::Dispose),
            }
        )
    );
}
