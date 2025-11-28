#include <cmath>
#include "common/common.h"
#include "globals/addonLog.h"
#include "ggml.h"
#include "llama.h"

#include "AddonGrammarEvaluationState.h"
#include "AddonSampler.h"

AddonSampler::AddonSampler(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AddonSampler>(info) {
    model = Napi::ObjectWrap<AddonModel>::Unwrap(info[0].As<Napi::Object>());
    model->Ref();

    tokenCandidates.resize(llama_vocab_n_tokens(model->vocab));
    tokenCandidates.reserve(llama_vocab_n_tokens(model->vocab));
}
AddonSampler::~AddonSampler() {
    dispose();
}

void AddonSampler::dispose() {
    if (disposed) {
        return;
    }

    disposed = true;

    model->Unref();
    freeChain();

    if (temperatureSampler != nullptr) {
        llama_sampler_free(temperatureSampler);
        temperatureSampler = nullptr;
    }

    if (greedySampler != nullptr) {
        llama_sampler_free(greedySampler);
        greedySampler = nullptr;
    }

    if (minPSampler != nullptr) {
        llama_sampler_free(minPSampler);
        minPSampler = nullptr;
    }

    if (topKSampler != nullptr) {
        llama_sampler_free(topKSampler);
        topKSampler = nullptr;
    }

    if (topPSampler != nullptr) {
        llama_sampler_free(topPSampler);
        topPSampler = nullptr;
    }

    if (seedSampler != nullptr) {
        llama_sampler_free(seedSampler);
        seedSampler = nullptr;
    }

    if (repeatPenaltySampler != nullptr) {
        llama_sampler_free(repeatPenaltySampler);
        repeatPenaltySampler = nullptr;
    }

    if (tokenBiasSampler != nullptr) {
        llama_sampler_free(tokenBiasSampler);
        tokenBiasSampler = nullptr;
    }

    if (grammarEvaluationState != nullptr) {
        grammarEvaluationState->Unref();
        grammarEvaluationState = nullptr;
    }
}

void AddonSampler::freeChain() {
    if (chain == nullptr) {
        return;
    }

    // ensure existing state of samplers isn't cleared
    while (llama_sampler_chain_n(chain) > 0) {
        llama_sampler_chain_remove(chain, 0);
    }

    llama_sampler_free(chain);
    chain = nullptr;
}

void AddonSampler::rebuildChainIfNeeded() {
    if (disposed) {
        throw std::runtime_error("Sampler is disposed");
    }

    if (chain != nullptr) {
        return;
    }

    auto sampler_params = llama_sampler_chain_default_params();
    chain = llama_sampler_chain_init(sampler_params);

    if (tokenBiasSampler != nullptr) {
        llama_sampler_chain_add(chain, tokenBiasSampler);
    }

    if (repeatPenaltySampler != nullptr) {
        llama_sampler_chain_add(chain, repeatPenaltySampler);
    }

    if (grammarEvaluationState != nullptr) {
        llama_sampler_chain_add(chain, grammarEvaluationState->sampler);
    }

    if (greedySampler != nullptr) {
        llama_sampler_chain_add(chain, greedySampler);
    } else {
        if (topKSampler != nullptr) {
            llama_sampler_chain_add(chain, topKSampler);
        }

        if (topPSampler != nullptr) {
            llama_sampler_chain_add(chain, topPSampler);
        }

        if (minPSampler != nullptr) {
            llama_sampler_chain_add(chain, minPSampler);
        }

        if (temperatureSampler != nullptr) {
            llama_sampler_chain_add(chain, temperatureSampler);
        }

        if (seedSampler != nullptr) {
            llama_sampler_chain_add(chain, seedSampler);
        }
    }
}

void AddonSampler::acceptToken(llama_token token) {
    if (repeatPenaltySampler != nullptr) {
        llama_sampler_accept(repeatPenaltySampler, token);
        repeatPenalty_lastTokens.push_back(token);
    }

    if (grammarEvaluationState != nullptr && grammarEvaluationState->sampler != nullptr && !llama_vocab_is_eog(model->vocab, token)) {
        llama_sampler_accept(grammarEvaluationState->sampler, token);
    }
}

Napi::Value AddonSampler::Dispose(const Napi::CallbackInfo& info) {
    dispose();
    return info.Env().Undefined();
}
Napi::Value AddonSampler::ApplyConfig(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Sampler is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    const int32_t n_probs = 0; // Number of probabilities to keep - 0 = disabled
    size_t min_keep = std::max(1, n_probs);

    Napi::Object config = info[0].As<Napi::Object>();

    if (config.Has("temperature")) {
        auto temperature = config.Get("temperature").As<Napi::Number>().FloatValue();
        if (temperature != temperatureSampler_temperature || !temperatureSampler_initialized) {
            temperatureSampler_initialized = true;
            temperatureSampler_temperature = temperature;
            freeChain();

            if (temperatureSampler != nullptr) {
                llama_sampler_free(temperatureSampler);
                temperatureSampler = nullptr;
            }

            if (temperatureSampler_temperature <= 0) {
                greedySampler = llama_sampler_init_greedy();
            } else {
                temperatureSampler = llama_sampler_init_temp(temperatureSampler_temperature);

                if (greedySampler != nullptr) {
                    llama_sampler_free(greedySampler);
                    greedySampler = nullptr;
                }
            }
        }
    } else {
         if (temperatureSampler != nullptr) {
            freeChain();
            llama_sampler_free(temperatureSampler);
            temperatureSampler = nullptr;
         }

        if (greedySampler == nullptr) {
            greedySampler = llama_sampler_init_greedy();
        }
    }

    if (config.Has("minP")) {
        auto minP = config.Get("minP").As<Napi::Number>().FloatValue();
        if (minP != minPSampler_minP) {
            minPSampler_minP = minP;
            freeChain();

            if (minPSampler != nullptr) {
                llama_sampler_free(minPSampler);
                minPSampler = nullptr;
            }

            if (minPSampler_minP != 0) {
                minPSampler = llama_sampler_init_min_p(minPSampler_minP, min_keep);
            }
        }
    } else if (minPSampler != nullptr) {
        freeChain();
        llama_sampler_free(minPSampler);
        minPSampler = nullptr;
    }

    if (config.Has("topK")) {
        auto topK = config.Get("topK").As<Napi::Number>().Int32Value();
        if (topK != topKSampler_topK || !topKSampler_initialized) {
            topKSampler_initialized = true;
            topKSampler_topK = topK;
            freeChain();

            if (topKSampler != nullptr) {
                llama_sampler_free(topKSampler);
                topKSampler = nullptr;
            }

            const int32_t resolved_top_k = topKSampler_topK <= 0
                ? llama_vocab_n_tokens(model->vocab)
                : std::min(topKSampler_topK, llama_vocab_n_tokens(model->vocab));

            topKSampler = llama_sampler_init_top_k(resolved_top_k);
        }
    } else if (topKSampler != nullptr) {
        freeChain();
        llama_sampler_free(topKSampler);
        topKSampler = nullptr;
    }

    if (config.Has("topP")) {
        auto topP = config.Get("topP").As<Napi::Number>().FloatValue();
        if (topP != topPSampler_topP) {
            topPSampler_topP = topP;
            freeChain();

            if (topPSampler != nullptr) {
                llama_sampler_free(topPSampler);
                topPSampler = nullptr;
            }

            if (topPSampler_topP >= 1) {
                topPSampler = llama_sampler_init_top_p(topPSampler_topP, min_keep);
            }
        }
    } else if (topPSampler != nullptr) {
        freeChain();
        llama_sampler_free(topPSampler);
        topPSampler = nullptr;
    }

    if (config.Has("seed")) {
        auto seed = config.Get("seed").As<Napi::Number>().Uint32Value();
        if (seed != seedSampler_seed || seedSampler == nullptr) {
            seedSampler_seed = seed;
            freeChain();

            if (seedSampler != nullptr) {
                llama_sampler_free(seedSampler);
                seedSampler = nullptr;
            }

            seedSampler = llama_sampler_init_dist(seedSampler_seed);
        }
    } else if (seedSampler == nullptr) {
        freeChain();
        seedSampler = llama_sampler_init_dist(time(NULL));
    }

    if (config.Has("repeatPenaltyTokens")) {
        Napi::Uint32Array repeat_penalty_tokens_uint32_array = config.Get("repeatPenaltyTokens").As<Napi::Uint32Array>();
        auto repeatPenalty = config.Has("repeatPenalty")
            ? config.Get("repeatPenalty").As<Napi::Number>().FloatValue()
            : 1;
        auto repeatPenaltyMaxTokens = config.Has("repeatPenaltyMaxTokens")
            ? config.Get("repeatPenaltyMaxTokens").As<Napi::Number>().Int32Value()
            : 64;
        auto repeatPenaltyPresencePenalty = config.Has("repeatPenaltyPresencePenalty")
            ? config.Get("repeatPenaltyPresencePenalty").As<Napi::Number>().FloatValue()
            : 0;
        auto repeatPenaltyFrequencyPenalty = config.Has("repeatPenaltyFrequencyPenalty")
            ? config.Get("repeatPenaltyFrequencyPenalty").As<Napi::Number>().FloatValue()
            : 0;

        auto repeatPenaltyEnabled = repeatPenalty != 1 && repeatPenaltyMaxTokens > 0;
        bool shouldCreateSampler = false;

        if (!repeatPenaltyEnabled) {
            if (repeatPenaltySampler != nullptr) {
                freeChain();
                llama_sampler_free(repeatPenaltySampler);
                repeatPenaltySampler = nullptr;
            }
        } else if (repeatPenaltySampler == nullptr) {
            freeChain();
            shouldCreateSampler = true;
        } else {
            bool existingSamplerMatchesConfig = true;
            existingSamplerMatchesConfig &= repeatPenalty_maxTokens == repeatPenaltyMaxTokens;
            existingSamplerMatchesConfig &= repeatPenalty_penalty == repeatPenalty;
            existingSamplerMatchesConfig &= repeatPenalty_presencePenalty == repeatPenaltyPresencePenalty;
            existingSamplerMatchesConfig &= repeatPenalty_frequencyPenalty == repeatPenaltyFrequencyPenalty;

            if (existingSamplerMatchesConfig) {
                if (repeat_penalty_tokens_uint32_array.ElementLength() > 0) {
                    const auto firstToken = static_cast<llama_token>(repeat_penalty_tokens_uint32_array[0]);
                    if (repeatPenalty_lastTokens.rat(0) != firstToken &&
                        repeatPenalty_lastTokens.size() == repeatPenalty_maxTokens &&
                        repeat_penalty_tokens_uint32_array.ElementLength() == repeatPenalty_maxTokens
                    ) {
                        const auto lastToken = static_cast<llama_token>(repeat_penalty_tokens_uint32_array[repeat_penalty_tokens_uint32_array.ElementLength() - 1]);
                        llama_sampler_accept(repeatPenaltySampler, lastToken);
                        repeatPenalty_lastTokens.push_back(lastToken);
                    }
                }
                for (size_t i = 0; i < repeat_penalty_tokens_uint32_array.ElementLength() && existingSamplerMatchesConfig; i++) {
                    auto token = static_cast<llama_token>(repeat_penalty_tokens_uint32_array[i]);

                    if (i < repeatPenalty_lastTokens.size()) {
                        existingSamplerMatchesConfig &= repeatPenalty_lastTokens.rat(i) == token;
                    } else {
                        llama_sampler_accept(repeatPenaltySampler, token);
                        repeatPenalty_lastTokens.push_back(token);
                    }
                }
            }

            if (!existingSamplerMatchesConfig) {
                freeChain();
                llama_sampler_free(repeatPenaltySampler);
                repeatPenaltySampler = nullptr;

                shouldCreateSampler = true;
            }
        }

        if (shouldCreateSampler) {
            repeatPenaltySampler = llama_sampler_init_penalties(
                repeatPenaltyMaxTokens,
                repeatPenalty,
                repeatPenaltyFrequencyPenalty,
                repeatPenaltyPresencePenalty
            );
            repeatPenalty_lastTokens = RingBuffer<llama_token>(repeatPenaltyMaxTokens);

            for (size_t i = 0; i < repeat_penalty_tokens_uint32_array.ElementLength(); i++) {
                llama_sampler_accept(repeatPenaltySampler, static_cast<llama_token>(repeat_penalty_tokens_uint32_array[i]));
                repeatPenalty_lastTokens.push_back(static_cast<llama_token>(repeat_penalty_tokens_uint32_array[i]));
            }

            repeatPenalty_maxTokens = repeatPenaltyMaxTokens;
            repeatPenalty_penalty = repeatPenalty;
            repeatPenalty_presencePenalty = repeatPenaltyPresencePenalty;
            repeatPenalty_frequencyPenalty = repeatPenaltyFrequencyPenalty;
        }
    } else if (repeatPenaltySampler != nullptr) {
        freeChain();
        llama_sampler_free(repeatPenaltySampler);
        repeatPenaltySampler = nullptr;
    }

    if (config.Has("tokenBiasKeys") && config.Has("tokenBiasValues")) {
        Napi::Uint32Array tokenBiasKeys = config.Get("tokenBiasKeys").As<Napi::Uint32Array>();
        Napi::Float32Array tokenBiasValues = config.Get("tokenBiasValues").As<Napi::Float32Array>();

        if (tokenBiasKeys.ElementLength() == tokenBiasValues.ElementLength() && tokenBiasKeys.ElementLength() > 0) {
            bool existingSamplerMatchesConfig = tokenBiasSampler != nullptr;

            if (tokenBiasSampler != nullptr && tokenBiasSampler_biases.size() == tokenBiasKeys.ElementLength()) {
                for (size_t i = 0; i < tokenBiasKeys.ElementLength() && existingSamplerMatchesConfig; i++) {
                    existingSamplerMatchesConfig &= tokenBiasSampler_biases[i].token == static_cast<llama_token>(tokenBiasKeys[i]);
                    existingSamplerMatchesConfig &= tokenBiasSampler_biases[i].bias == tokenBiasValues[i];
                }
            } else {
                existingSamplerMatchesConfig = false;
            }

            if (!existingSamplerMatchesConfig) {
                if (tokenBiasSampler != nullptr) {
                    freeChain();
                    llama_sampler_free(tokenBiasSampler);
                    tokenBiasSampler = nullptr;
                }

                tokenBiasSampler_biases.clear();
                tokenBiasSampler_biases.reserve(tokenBiasKeys.ElementLength());

                for (size_t i = 0; i < tokenBiasKeys.ElementLength(); i++) {
                    tokenBiasSampler_biases.emplace_back(llama_logit_bias { static_cast<llama_token>(tokenBiasKeys[i]), tokenBiasValues[i] });
                }

                tokenBiasSampler = llama_sampler_init_logit_bias(
                    llama_vocab_n_tokens(model->vocab),
                    tokenBiasSampler_biases.size(),
                    tokenBiasSampler_biases.data()
                );
            }
        } else if (tokenBiasSampler != nullptr) {
            freeChain();
            llama_sampler_free(tokenBiasSampler);
            tokenBiasSampler = nullptr;
        }
    } else if (tokenBiasSampler != nullptr) {
        freeChain();
        llama_sampler_free(tokenBiasSampler);
        tokenBiasSampler = nullptr;
    }

    if (config.Has("grammarEvaluationState")) {
        const auto configGrammarEvaluationState =
            Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(config.Get("grammarEvaluationState").As<Napi::Object>());

        if (grammarEvaluationState != configGrammarEvaluationState) {
            freeChain();

            if (grammarEvaluationState != nullptr) {
                grammarEvaluationState->Unref();
                grammarEvaluationState = nullptr;
            }

            grammarEvaluationState = configGrammarEvaluationState;
            grammarEvaluationState->Ref();
        }
    } else if (grammarEvaluationState != nullptr) {
        freeChain();
        grammarEvaluationState->Unref();
        grammarEvaluationState = nullptr;
    }

    return info.Env().Undefined();
}

Napi::Value AddonSampler::AcceptGrammarEvaluationStateToken(const Napi::CallbackInfo& info) {
    AddonGrammarEvaluationState* grammar_evaluation_state =
        Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(info[0].As<Napi::Object>());
    llama_token tokenId = info[1].As<Napi::Number>().Int32Value();

    if ((grammar_evaluation_state)->sampler != nullptr) {
        try {
            llama_sampler_accept((grammar_evaluation_state)->sampler, tokenId);
        } catch (const std::exception & e) {
            Napi::Error::New(info.Env(), std::string("Failed to accept token in grammar sampler: ") + e.what()).ThrowAsJavaScriptException();
            return info.Env().Undefined();
        } catch (...) {
            Napi::Error::New(info.Env(), "Failed to accept token in grammar sampler").ThrowAsJavaScriptException();
            return info.Env().Undefined();
        }
    }

    return info.Env().Undefined();
}
Napi::Value AddonSampler::CanBeNextTokenForGrammarEvaluationState(const Napi::CallbackInfo& info) {
    AddonGrammarEvaluationState* grammar_evaluation_state =
        Napi::ObjectWrap<AddonGrammarEvaluationState>::Unwrap(info[0].As<Napi::Object>());
    llama_token tokenId = info[1].As<Napi::Number>().Int32Value();

    if ((grammar_evaluation_state)->sampler != nullptr) {
        std::vector<llama_token_data> candidates;
        candidates.reserve(1);
        candidates.emplace_back(llama_token_data { tokenId, 1, 0.0f });

        llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };
        try {
            llama_sampler_apply((grammar_evaluation_state)->sampler, &candidates_p);
        } catch (const std::exception & e) {
            addonLog(GGML_LOG_LEVEL_DEBUG, std::string("Failed to apply grammar sampler: ") + e.what());
            return Napi::Boolean::New(info.Env(), false);
        } catch (...) {
            return Napi::Boolean::New(info.Env(), false);
        }

        if (candidates_p.size == 0 || candidates_p.data[0].logit == -INFINITY) {
            return Napi::Boolean::New(info.Env(), false);
        }

        return Napi::Boolean::New(info.Env(), true);
    }

    return Napi::Boolean::New(info.Env(), false);
}

void AddonSampler::init(Napi::Object exports) {
    exports.Set(
        "AddonSampler",
        DefineClass(
            exports.Env(),
            "AddonSampler",
            {
                InstanceMethod("dispose", &AddonSampler::Dispose),
                InstanceMethod("applyConfig", &AddonSampler::ApplyConfig),
                StaticMethod("acceptGrammarEvaluationStateToken", &AddonSampler::AcceptGrammarEvaluationStateToken),
                StaticMethod("canBeNextTokenForGrammarEvaluationState", &AddonSampler::CanBeNextTokenForGrammarEvaluationState),
            }
        )
    );
}
