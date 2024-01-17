#include <stddef.h>

#include <algorithm>
#include <sstream>
#include <vector>

#include "common.h"
#include "common/grammar-parser.h"
#include "llama.h"
#include "napi.h"

std::string addon_model_token_to_piece(const struct llama_model * model, llama_token token) {
    std::vector<char> result(8, 0);
    const int n_tokens = llama_token_to_piece(model, token, result.data(), result.size());
    if (n_tokens < 0) {
        result.resize(-n_tokens);
        int check = llama_token_to_piece(model, token, result.data(), result.size());
        GGML_ASSERT(check == -n_tokens);
    }
    else {
        result.resize(n_tokens);
    }

    return std::string(result.data(), result.size());
}

class AddonModel : public Napi::ObjectWrap<AddonModel> {
    public:
        llama_model_params model_params;
        llama_model* model;
        bool disposed = false;

        AddonModel(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonModel>(info) {
            model_params = llama_model_default_params();

            // Get the model path
            std::string modelPath = info[0].As<Napi::String>().Utf8Value();

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("gpuLayers")) {
                    model_params.n_gpu_layers = options.Get("gpuLayers").As<Napi::Number>().Int32Value();
                }

                if (options.Has("vocabOnly")) {
                    model_params.vocab_only = options.Get("vocabOnly").As<Napi::Boolean>().Value();
                }

                if (options.Has("useMmap")) {
                    model_params.use_mmap = options.Get("useMmap").As<Napi::Boolean>().Value();
                }

                if (options.Has("useMlock")) {
                    model_params.use_mlock = options.Get("useMlock").As<Napi::Boolean>().Value();
                }
            }

            llama_backend_init(false);
            model = llama_load_model_from_file(modelPath.c_str(), model_params);

            if (model == NULL) {
                Napi::Error::New(info.Env(), "Failed to load model").ThrowAsJavaScriptException();
                return;
            }
        }

        ~AddonModel() {
            dispose();
        }

        void dispose() {
            if (disposed) {
                return;
            }

            llama_free_model(model);
            disposed = true;
        }

        Napi::Value Dispose(const Napi::CallbackInfo& info) {
            if (disposed) {
                return info.Env().Undefined();
            }

            dispose();

            return info.Env().Undefined();
        }

        Napi::Value Tokenize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            std::string text = info[0].As<Napi::String>().Utf8Value();
            bool specialTokens = info[1].As<Napi::Boolean>().Value();

            std::vector<llama_token> tokens = llama_tokenize(model, text, false, specialTokens);

            Napi::Uint32Array result = Napi::Uint32Array::New(info.Env(), tokens.size());
            for (size_t i = 0; i < tokens.size(); ++i) {
                result[i] = static_cast<uint32_t>(tokens[i]);
            }

            return result;
        }
        Napi::Value Detokenize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            Napi::Uint32Array tokens = info[0].As<Napi::Uint32Array>();

            // Create a stringstream for accumulating the decoded string.
            std::stringstream ss;

            // Decode each token and accumulate the result.
            for (size_t i = 0; i < tokens.ElementLength(); i++) {
                const std::string piece = addon_model_token_to_piece(model, (llama_token)tokens[i]);

                if (piece.empty()) {
                    continue;
                }

                ss << piece;
            }

            return Napi::String::New(info.Env(), ss.str());
        }

        Napi::Value GetTrainContextSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_n_ctx_train(model));
        }

        Napi::Value GetTotalSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_model_size(model));
        }

        Napi::Value GetTotalParameters(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_model_n_params(model));
        }

        Napi::Value GetModelDescription(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            char model_desc[128];
            int actual_length = llama_model_desc(model, model_desc, sizeof(model_desc));

            return Napi::String::New(info.Env(), model_desc, actual_length);
        }

        Napi::Value TokenBos(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_token_bos(model));
        }
        Napi::Value TokenEos(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_token_eos(model));
        }
        Napi::Value TokenNl(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_token_nl(model));
        }
        Napi::Value PrefixToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_token_prefix(model));
        }
        Napi::Value MiddleToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_token_middle(model));
        }
        Napi::Value SuffixToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_token_suffix(model));
        }
        Napi::Value EotToken(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_token_eot(model));
        }
        Napi::Value GetTokenString(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int token = info[0].As<Napi::Number>().Int32Value();
            std::stringstream ss;

            const char* str = llama_token_get_text(model, token);
            if (str == nullptr) {
                return info.Env().Undefined();
            }

            ss << str;

            return Napi::String::New(info.Env(), ss.str());
        }

        static void init(Napi::Object exports) {
            exports.Set(
                "AddonModel",
                DefineClass(
                    exports.Env(),
                    "AddonModel",
                    {
                        InstanceMethod("tokenize", &AddonModel::Tokenize),
                        InstanceMethod("detokenize", &AddonModel::Detokenize),
                        InstanceMethod("getTrainContextSize", &AddonModel::GetTrainContextSize),
                        InstanceMethod("getTotalSize", &AddonModel::GetTotalSize),
                        InstanceMethod("getTotalParameters", &AddonModel::GetTotalParameters),
                        InstanceMethod("getModelDescription", &AddonModel::GetModelDescription),
                        InstanceMethod("tokenBos", &AddonModel::TokenBos),
                        InstanceMethod("tokenEos", &AddonModel::TokenEos),
                        InstanceMethod("tokenNl", &AddonModel::TokenNl),
                        InstanceMethod("prefixToken", &AddonModel::PrefixToken),
                        InstanceMethod("middleToken", &AddonModel::MiddleToken),
                        InstanceMethod("suffixToken", &AddonModel::SuffixToken),
                        InstanceMethod("eotToken", &AddonModel::EotToken),
                        InstanceMethod("getTokenString", &AddonModel::GetTokenString),
                        InstanceMethod("dispose", &AddonModel::Dispose)
                    }
                )
            );
        }
};

class AddonGrammar : public Napi::ObjectWrap<AddonGrammar> {
    public:
        grammar_parser::parse_state parsed_grammar;

        AddonGrammar(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammar>(info) {
            // Get the model path
            std::string grammarCode = info[0].As<Napi::String>().Utf8Value();
            bool should_print_grammar = false;

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("printGrammar")) {
                    should_print_grammar = options.Get("printGrammar").As<Napi::Boolean>().Value();
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

        static void init(Napi::Object exports) {
            exports.Set("AddonGrammar", DefineClass(exports.Env(), "AddonGrammar", {}));
        }
};

class AddonGrammarEvaluationState : public Napi::ObjectWrap<AddonGrammarEvaluationState> {
    public:
        AddonGrammar* grammarDef;
        llama_grammar* grammar = nullptr;

        AddonGrammarEvaluationState(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonGrammarEvaluationState>(info) {
            grammarDef = Napi::ObjectWrap<AddonGrammar>::Unwrap(info[0].As<Napi::Object>());
            grammarDef->Ref();

            std::vector<const llama_grammar_element*> grammar_rules(grammarDef->parsed_grammar.c_rules());
            grammar = llama_grammar_init(grammar_rules.data(), grammar_rules.size(), grammarDef->parsed_grammar.symbol_ids.at("root"));
        }

        ~AddonGrammarEvaluationState() {
            grammarDef->Unref();

            if (grammar != nullptr) {
                llama_grammar_free(grammar);
                grammar = nullptr;
            }
        }

        static void init(Napi::Object exports) {
            exports.Set("AddonGrammarEvaluationState", DefineClass(exports.Env(), "AddonGrammarEvaluationState", {}));
        }
};

class AddonContext : public Napi::ObjectWrap<AddonContext> {
    public:
        AddonModel* model;
        llama_context_params context_params;
        llama_context* ctx;
        llama_batch batch;
        bool has_batch = false;
        int32_t batch_n_tokens = 0;
        int n_cur = 0;
        bool disposed = false;

        AddonContext(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonContext>(info) {
            model = Napi::ObjectWrap<AddonModel>::Unwrap(info[0].As<Napi::Object>());
            model->Ref();

            context_params = llama_context_default_params();
            context_params.seed = -1;
            context_params.n_ctx = 4096;
            context_params.n_threads = 6;
            context_params.n_threads_batch = context_params.n_threads;

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("seed")) {
                    context_params.seed = options.Get("seed").As<Napi::Number>().Uint32Value();
                }

                if (options.Has("contextSize")) {
                    context_params.n_ctx = options.Get("contextSize").As<Napi::Number>().Uint32Value();
                }

                if (options.Has("batchSize")) {
                    context_params.n_batch = options.Get("batchSize").As<Napi::Number>().Uint32Value();
                }

                if (options.Has("logitsAll")) {
                    context_params.logits_all = options.Get("logitsAll").As<Napi::Boolean>().Value();
                }

                if (options.Has("embedding")) {
                    context_params.embedding = options.Get("embedding").As<Napi::Boolean>().Value();
                }

                if (options.Has("threads")) {
                    const auto n_threads = options.Get("threads").As<Napi::Number>().Uint32Value();
                    const auto resolved_n_threads = n_threads == 0 ? std::thread::hardware_concurrency() : n_threads;

                    context_params.n_threads = resolved_n_threads;
                    context_params.n_threads_batch = resolved_n_threads
                }
            }

            ctx = llama_new_context_with_model(model->model, context_params);
            Napi::MemoryManagement::AdjustExternalMemory(Env(), llama_get_state_size(ctx));
        }
        ~AddonContext() {
            dispose();
        }

        void dispose() {
            if (disposed) {
                return;
            }

            Napi::MemoryManagement::AdjustExternalMemory(Env(), -(int64_t)llama_get_state_size(ctx));
            llama_free(ctx);
            model->Unref();

            disposeBatch();

            disposed = true;
        }
        void disposeBatch() {
            if (!has_batch) {
                return;
            }

            llama_batch_free(batch);
            has_batch = false;
            batch_n_tokens = 0;
        }
        Napi::Value Dispose(const Napi::CallbackInfo& info) {
            if (disposed) {
                return info.Env().Undefined();
            }

            dispose();

            return info.Env().Undefined();
        }
        Napi::Value GetContextSize(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            return Napi::Number::From(info.Env(), llama_n_ctx(ctx));
        }
        Napi::Value InitBatch(const Napi::CallbackInfo& info) {
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

            return info.Env().Undefined();
        }
        Napi::Value DisposeBatch(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            disposeBatch();

            return info.Env().Undefined();
        }
        Napi::Value AddToBatch(const Napi::CallbackInfo& info) {
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
        Napi::Value DisposeSequence(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();

            llama_kv_cache_seq_rm(ctx, sequenceId, -1, -1);

            return info.Env().Undefined();
        }
        Napi::Value RemoveTokenCellsFromSequence(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
            int32_t startPos = info[1].As<Napi::Number>().Int32Value();
            int32_t endPos = info[2].As<Napi::Number>().Int32Value();

            llama_kv_cache_seq_rm(ctx, sequenceId, startPos, endPos);

            return info.Env().Undefined();
        }
        Napi::Value ShiftSequenceTokenCells(const Napi::CallbackInfo& info) {
            if (disposed) {
                Napi::Error::New(info.Env(), "Context is disposed").ThrowAsJavaScriptException();
                return info.Env().Undefined();
            }

            int32_t sequenceId = info[0].As<Napi::Number>().Int32Value();
            int32_t startPos = info[1].As<Napi::Number>().Int32Value();
            int32_t endPos = info[2].As<Napi::Number>().Int32Value();
            int32_t shiftDelta = info[3].As<Napi::Number>().Int32Value();

            llama_kv_cache_seq_shift(ctx, sequenceId, startPos, endPos, shiftDelta);

            return info.Env().Undefined();
        }
        Napi::Value DecodeBatch(const Napi::CallbackInfo& info);
        Napi::Value SampleToken(const Napi::CallbackInfo& info);

        Napi::Value AcceptGrammarEvaluationStateToken(const Napi::CallbackInfo& info) {
            AddonGrammarEvaluationState* grammar_evaluation_state = Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(info[0].As<Napi::Object>());
            llama_token tokenId = info[1].As<Napi::Number>().Int32Value();

            if ((grammar_evaluation_state)->grammar != nullptr) {
                llama_grammar_accept_token(ctx, (grammar_evaluation_state)->grammar, tokenId);
            }

            return info.Env().Undefined();
        }

        static void init(Napi::Object exports) {
            exports.Set(
                "AddonContext",
                DefineClass(
                    exports.Env(),
                    "AddonContext",
                    {
                        InstanceMethod("getContextSize", &AddonContext::GetContextSize),
                        InstanceMethod("initBatch", &AddonContext::InitBatch),
                        InstanceMethod("addToBatch", &AddonContext::AddToBatch),
                        InstanceMethod("disposeSequence", &AddonContext::DisposeSequence),
                        InstanceMethod("removeTokenCellsFromSequence", &AddonContext::RemoveTokenCellsFromSequence),
                        InstanceMethod("shiftSequenceTokenCells", &AddonContext::ShiftSequenceTokenCells),
                        InstanceMethod("decodeBatch", &AddonContext::DecodeBatch),
                        InstanceMethod("sampleToken", &AddonContext::SampleToken),
                        InstanceMethod("acceptGrammarEvaluationStateToken", &AddonContext::AcceptGrammarEvaluationStateToken),
                        InstanceMethod("dispose", &AddonContext::Dispose)
                    }
                )
            );
        }
};


class AddonContextDecodeBatchWorker : Napi::AsyncWorker, Napi::Promise::Deferred {
    public:
        AddonContext* ctx;

        AddonContextDecodeBatchWorker(const Napi::CallbackInfo& info, AddonContext* ctx)
            : Napi::AsyncWorker(info.Env(), "AddonContextDecodeBatchWorker"),
              ctx(ctx),
              Napi::Promise::Deferred(info.Env()) {
            ctx->Ref();
        }
        ~AddonContextDecodeBatchWorker() {
            ctx->Unref();
        }
        using Napi::AsyncWorker::Queue;
        using Napi::Promise::Deferred::Promise;

    protected:
        void Execute() {
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
        }
        void OnOK() {
            Napi::Env env = Napi::AsyncWorker::Env();
            Napi::Promise::Deferred::Resolve(env.Undefined());
        }
        void OnError(const Napi::Error& err) {
            Napi::Promise::Deferred::Reject(err.Value());
        }
};

Napi::Value AddonContext::DecodeBatch(const Napi::CallbackInfo& info) {
    AddonContextDecodeBatchWorker* worker = new AddonContextDecodeBatchWorker(info, this);
    worker->Queue();
    return worker->Promise();
}

class AddonContextSampleTokenWorker : Napi::AsyncWorker, Napi::Promise::Deferred {
    public:
        AddonContext* ctx;
        AddonGrammarEvaluationState* grammar_evaluation_state;
        int32_t batchLogitIndex;
        bool use_grammar = false;
        llama_token result;
        float temperature = 0.0f;
        int32_t top_k = 40;
        float top_p = 0.95f;
        float repeat_penalty = 1.10f;  // 1.0 = disabled
        float repeat_penalty_presence_penalty = 0.00f;  // 0.0 = disabled
        float repeat_penalty_frequency_penalty = 0.00f;  // 0.0 = disabled
        std::vector<llama_token> repeat_penalty_tokens;
        bool use_repeat_penalty = false;

        AddonContextSampleTokenWorker(const Napi::CallbackInfo& info, AddonContext* ctx)
            : Napi::AsyncWorker(info.Env(), "AddonContextSampleTokenWorker"),
              ctx(ctx),
              Napi::Promise::Deferred(info.Env()) {
            ctx->Ref();

            batchLogitIndex = info[0].As<Napi::Number>().Int32Value();

            if (info.Length() > 1 && info[1].IsObject()) {
                Napi::Object options = info[1].As<Napi::Object>();

                if (options.Has("temperature")) {
                    temperature = options.Get("temperature").As<Napi::Number>().FloatValue();
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
        using Napi::AsyncWorker::Queue;
        using Napi::Promise::Deferred::Promise;

    protected:
        void Execute() {
            llama_token new_token_id = 0;

            // Select the best prediction.
            auto logits = llama_get_logits_ith(ctx->ctx, batchLogitIndex);
            auto n_vocab = llama_n_vocab(ctx->model->model);

            std::vector<llama_token_data> candidates;
            candidates.reserve(n_vocab);

            for (llama_token token_id = 0; token_id < n_vocab; token_id++) {
                candidates.emplace_back(llama_token_data { token_id, logits[token_id], 0.0f });
            }

            llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

            auto eos_token = llama_token_eos(ctx->model->model);

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
                llama_sample_grammar(ctx->ctx, &candidates_p, (grammar_evaluation_state)->grammar);
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
                llama_sample_temp(ctx->ctx, &candidates_p, temperature);
                new_token_id = llama_sample_token(ctx->ctx, &candidates_p);
            }

            if (new_token_id != eos_token && use_grammar && (grammar_evaluation_state)->grammar != nullptr) {
                llama_grammar_accept_token(ctx->ctx, (grammar_evaluation_state)->grammar, new_token_id);
            }

            result = new_token_id;
        }
        void OnOK() {
            Napi::Env env = Napi::AsyncWorker::Env();
            Napi::Number resultValue = Napi::Number::New(env, static_cast<uint32_t>(result));
            Napi::Promise::Deferred::Resolve(resultValue);
        }
        void OnError(const Napi::Error& err) {
            Napi::Promise::Deferred::Reject(err.Value());
        }
};

Napi::Value AddonContext::SampleToken(const Napi::CallbackInfo& info) {
    AddonContextSampleTokenWorker* worker = new AddonContextSampleTokenWorker(info, this);
    worker->Queue();
    return worker->Promise();
}

Napi::Value systemInfo(const Napi::CallbackInfo& info) {
    return Napi::String::From(info.Env(), llama_print_system_info());
}

Napi::Object registerCallback(Napi::Env env, Napi::Object exports) {
    llama_backend_init(false);
    exports.DefineProperties({
        Napi::PropertyDescriptor::Function("systemInfo", systemInfo),
    });
    AddonModel::init(exports);
    AddonGrammar::init(exports);
    AddonGrammarEvaluationState::init(exports);
    AddonContext::init(exports);
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, registerCallback)
