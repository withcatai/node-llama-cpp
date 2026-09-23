import {ChatWrapperSettings} from "../../../types.js";
import {LlamaText} from "../../../utils/LlamaText.js";
import {trimCommonLlamaTextSuffix} from "../../../utils/llamaTextUtils.js";

export function alignFunctionCallAndSegmentSettings(chatWrapperSettings: ChatWrapperSettings): ChatWrapperSettings {
    if (chatWrapperSettings.functions.parallelism?.result?.sectionSuffix == null || chatWrapperSettings.segments?.thought?.suffix == null)
        return chatWrapperSettings;

    const thoughtPrefixSetting = chatWrapperSettings.segments.thought.prefix;
    if (thoughtPrefixSetting != null && typeof thoughtPrefixSetting !== "string" && !LlamaText.isLlamaText(thoughtPrefixSetting)) {
        const callSectionSuffixLlamaText = LlamaText(chatWrapperSettings.functions.parallelism.result.sectionSuffix);
        const trimmedCallSectionSuffix = trimCommonLlamaTextSuffix(
            callSectionSuffixLlamaText,
            LlamaText(chatWrapperSettings.segments.thought.suffix),
            true
        );
        if (trimmedCallSectionSuffix !== callSectionSuffixLlamaText)
            return {
                ...chatWrapperSettings,
                functions: {
                    ...chatWrapperSettings.functions,
                    parallelism: {
                        ...chatWrapperSettings.functions.parallelism,
                        result: {
                            ...chatWrapperSettings.functions.parallelism.result,
                            sectionSuffix: trimmedCallSectionSuffix
                        }
                    }
                },
                segments: {
                    ...chatWrapperSettings.segments,
                    thought: {
                        ...chatWrapperSettings.segments.thought,
                        prefix: {
                            ...thoughtPrefixSetting,
                            afterFunctionCalls: true
                        }
                    }
                }
            };
    }


    return chatWrapperSettings;
}
