import {ChatPromptWrapper} from "../ChatPromptWrapper.js";
import {getTextCompletion} from "../utils/getTextCompletion.js";

// source: https://github.com/openai/openai-python/blob/120d225b91a8453e15240a49fb1c6794d8119326/chatml.md
export class ChatMLChatPromptWrapper extends ChatPromptWrapper {
    public readonly wrapperName: string = "ChatML";

    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex, lastStopString, lastStopStringSuffix}: {
        systemPrompt: string, promptIndex: number, lastStopString: string | null, lastStopStringSuffix: string | null
    }) {
        const previousCompletionEnd = (lastStopString ?? "") + (lastStopStringSuffix ?? "");

        if (promptIndex === 0 && systemPrompt != "")
            return (getTextCompletion(previousCompletionEnd, "<|im_start|>system\n") ?? "<|im_start|>system\n") +
                systemPrompt + "<|im_end|>\n<|im_start|>user\n" + prompt + "<|im_end|>\n<|im_start|>assistant\n";
        else
            return (getTextCompletion(previousCompletionEnd, "<|im_end|>\n<|im_start|>user\n") ?? "<|im_end|>\n<|im_start|>user\n") +
                prompt + "<|im_end|>\n<|im_start|>assistant\n";
    }

    public override getStopStrings(): string[] {
        return ["<|im_end|>"];
    }

    public override getDefaultStopString(): string {
        return "<|im_end|>";
    }
}
