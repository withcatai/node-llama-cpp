import {parseModelFileName} from "../utils/parseModelFileName.js";
import {parseModelTypeDescription} from "../utils/parseModelTypeDescription.js";
import {LlamaChatPromptWrapper} from "./LlamaChatPromptWrapper.js";
import {ChatMLChatPromptWrapper} from "./ChatMLChatPromptWrapper.js";
import {GeneralChatPromptWrapper} from "./GeneralChatPromptWrapper.js";
import {FalconChatPromptWrapper} from "./FalconChatPromptWrapper.js";
import type {ModelTypeDescription} from "../utils/getBin.js";


/**
 * @param options
 */
export function resolveChatWrapperBasedOnModel({
    bosString,
    filename,
    typeDescription
}: {
    bosString?: string | null,
    filename?: string,

    /** @hidden this type alias is too long in the documentation */
    typeDescription?: ModelTypeDescription
}) {
    if (filename != null) {
        const {name, subType, fileType} = parseModelFileName(filename);

        if (fileType?.toLowerCase() === "gguf") {
            const lowercaseName = name?.toLowerCase();
            const lowercaseSubType = subType?.toLowerCase();
            const splitLowercaseSubType = lowercaseSubType?.split("-");
            const firstSplitLowercaseSubType = splitLowercaseSubType?.[0];

            if (lowercaseName === "llama")
                return LlamaChatPromptWrapper;
            else if (lowercaseName === "yarn" && firstSplitLowercaseSubType === "llama")
                return LlamaChatPromptWrapper;
            else if (lowercaseName === "orca")
                return ChatMLChatPromptWrapper;
            else if (lowercaseName === "phind" && lowercaseSubType === "codellama")
                return LlamaChatPromptWrapper;
            else if (lowercaseName === "mistral")
                return GeneralChatPromptWrapper;
            else if (firstSplitLowercaseSubType === "llama")
                return LlamaChatPromptWrapper;
        }
    }

    if (typeDescription != null) {
        const {arch} = parseModelTypeDescription(typeDescription);

        if (arch === "llama")
            return LlamaChatPromptWrapper;
        else if (arch === "falcon")
            return FalconChatPromptWrapper;
    }

    if (bosString === "" || bosString == null)
        return null;

    if ("<s>[INST] <<SYS>>\n".startsWith(bosString)) {
        return LlamaChatPromptWrapper;
    } else if ("<|im_start|>system\n".startsWith(bosString)) {
        return ChatMLChatPromptWrapper;
    }

    return null;
}

