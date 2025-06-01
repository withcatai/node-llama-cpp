import {ChatWrapperSettings, Tokenizer} from "../../../types.js";
import {LlamaText, SpecialTokensText} from "../../../utils/LlamaText.js";
import {removeUndefinedFields} from "../../../utils/removeNullFields.js";

export function extractSegmentSettingsFromTokenizerAndChatTemplate(
    chatTemplate: string | undefined, tokenizer?: Tokenizer
): ChatWrapperSettings["segments"] {
    function tryMatchPrefixSuffixPair(tryMatchGroups: [prefix: string, suffix: string][]) {
        if (chatTemplate != null) {
            for (const [prefix, suffix] of tryMatchGroups) {
                if (chatTemplate.includes(prefix) && chatTemplate.includes(suffix))
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix)),
                        suffix: LlamaText(new SpecialTokensText(suffix))
                    };
            }
        }

        if (tokenizer != null) {
            for (const [prefix, suffix] of tryMatchGroups) {
                const thinkTokens = tokenizer(prefix, true, "trimLeadingSpace");
                const thinkEndTokens = tokenizer(suffix, true, "trimLeadingSpace");

                const [thinkToken] = thinkTokens;
                const [thinkEndToken] = thinkEndTokens;

                if (thinkTokens.length === 1 && thinkEndTokens.length === 1 &&
                    thinkToken != null && thinkEndToken != null
                ) {
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix)),
                        suffix: LlamaText(new SpecialTokensText(suffix))
                    };
                }
            }
        }

        return undefined;
    }

    return removeUndefinedFields({
        thought: tryMatchPrefixSuffixPair([
            ["<think>", "</think>"], // DeepSeek, QwQ
            ["<thought>", "</thought>"], // EXAONE Deep
            ["<|START_THINKING|>", "<|END_THINKING|>"] // Command R7B
        ])
    });
}
