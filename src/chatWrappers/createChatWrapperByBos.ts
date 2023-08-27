import {LlamaChatPromptWrapper} from "./LlamaChatPromptWrapper.js";
import {ChatMLPromptWrapper} from "./ChatMLPromptWrapper.js";

export function getChatWrapperByBos(bos: string | undefined | null) {
    if (bos === "" || bos == null)
        return null;

    if ("<s>[INST] <<SYS>>\n".startsWith(bos)) {
        return LlamaChatPromptWrapper;
    } else if ("<|im_start|>system\n".startsWith(bos)) {
        return ChatMLPromptWrapper;
    }

    return null;
}
