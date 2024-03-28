import {parseModelFileName} from "../utils/parseModelFileName.js";
import {LlamaChatWrapper} from "./LlamaChatWrapper.js";
import {ChatMLChatWrapper} from "./ChatMLChatWrapper.js";
import {GeneralChatWrapper} from "./GeneralChatWrapper.js";
import {FalconChatWrapper} from "./FalconChatWrapper.js";
import {FunctionaryChatWrapper} from "./FunctionaryChatWrapper.js";
import {AlpacaChatWrapper} from "./AlpacaChatWrapper.js";
import {GemmaChatWrapper} from "./GemmaChatWrapper.js";
import type {GgufFileInfo} from "../gguf/types/GgufFileInfoTypes.js";


/**
 * @param options
 */
export function resolveChatWrapperBasedOnModel({
    bosString,
    filename,
    fileInfo
}: {
    bosString?: string | null,
    filename?: string,
    fileInfo?: GgufFileInfo
}) {
    if (filename != null) {
        const {name, subType, fileType} = parseModelFileName(filename);

        if (fileType?.toLowerCase() === "gguf") {
            const lowercaseName = name?.toLowerCase();
            const lowercaseSubType = subType?.toLowerCase();
            const splitLowercaseSubType = lowercaseSubType?.split("-") ?? [];
            const firstSplitLowercaseSubType = splitLowercaseSubType[0];

            if (lowercaseName === "llama") {
                if (splitLowercaseSubType.includes("chat"))
                    return LlamaChatWrapper;

                return GeneralChatWrapper;
            } else if (lowercaseName === "yarn" && firstSplitLowercaseSubType === "llama")
                return LlamaChatWrapper;
            else if (lowercaseName === "orca")
                return ChatMLChatWrapper;
            else if (lowercaseName === "phind" && lowercaseSubType === "codellama")
                return LlamaChatWrapper;
            else if (lowercaseName === "mistral")
                return GeneralChatWrapper;
            else if (firstSplitLowercaseSubType === "llama")
                return LlamaChatWrapper;
            else if (lowercaseSubType === "alpaca")
                return AlpacaChatWrapper;
            else if (lowercaseName === "functionary")
                return FunctionaryChatWrapper;
            else if (lowercaseName === "dolphin" && splitLowercaseSubType.includes("mistral"))
                return ChatMLChatWrapper;
            else if (lowercaseName === "gemma")
                return GemmaChatWrapper;
        }
    }

    if (fileInfo != null) {
        const arch = fileInfo.metadata.general?.architecture;

        if (arch === "llama")
            return LlamaChatWrapper;
        else if (arch === "falcon")
            return FalconChatWrapper;
    }

    if (bosString === "" || bosString == null)
        return null;

    if ("<s>[INST] <<SYS>>\n".startsWith(bosString)) {
        return LlamaChatWrapper;
    } else if ("<|im_start|>system\n".startsWith(bosString)) {
        return ChatMLChatWrapper;
    }

    return null;
}

