import {ChatWrapperSettings, Tokenizer} from "../../../types.js";
import {LlamaText, SpecialTokensText} from "../../../utils/LlamaText.js";
import {removeUndefinedFields} from "../../../utils/removeNullFields.js";

export function extractSegmentSettingsFromTokenizerAndChatTemplate(
    chatTemplate: string | undefined, tokenizer?: Tokenizer
): ChatWrapperSettings["segments"] {
    function tryMatchPrefixSuffixPair(tryMatchGroups: [prefix: string, suffix: string][]) {
        if (chatTemplate != null) {
            for (const [prefix, suffix] of tryMatchGroups) {
                if (
                    (
                        hasAll(chatTemplate.replaceAll(prefix + "\\n\\n" + suffix, ""), [
                            prefix + "\\n\\n",
                            "\\n\\n" + suffix
                        ])
                    ) || (
                        hasAll(chatTemplate.replaceAll(prefix + "\n\n" + suffix, ""), [
                            prefix + "\n\n",
                            "\n\n" + suffix
                        ])
                    )
                )
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix + "\n\n")),
                        suffix: LlamaText(new SpecialTokensText("\n\n" + suffix))
                    };

                if (
                    (
                        hasAll(chatTemplate.replaceAll(prefix + "\\n" + suffix, ""), [
                            prefix + "\\n",
                            "\\n" + suffix
                        ])
                    ) || (
                        hasAll(chatTemplate.replaceAll(prefix + "\n" + suffix, ""), [
                            prefix + "\n",
                            "\n" + suffix
                        ])
                    )
                )
                    return {
                        prefix: LlamaText(new SpecialTokensText(prefix + "\n")),
                        suffix: LlamaText(new SpecialTokensText("\n" + suffix))
                    };

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
            ["<|START_THINKING|>", "<|END_THINKING|>"], // Command R7B
            ["<|begin_of_thought|>", "<|end_of_thought|>"] // JoyAI
        ])
    });
}

function hasAll(text: string, matches: string[]) {
    return matches.every((match) => text.includes(match));
}
