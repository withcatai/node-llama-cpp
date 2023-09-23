import {ChatPromptWrapper} from "../ChatPromptWrapper.js";
import {getTextCompletion} from "../utils/getTextCompletion.js";

// source: https://huggingface.co/blog/llama2#how-to-prompt-llama-2
export class LlamaChatPromptWrapper extends ChatPromptWrapper {
    public readonly wrapperName: string = "LlamaChat";

    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex, lastStopString, lastStopStringSuffix}: {
        systemPrompt: string, promptIndex: number, lastStopString: string | null, lastStopStringSuffix: string | null
    }) {
        const previousCompletionEnd = (lastStopString ?? "") + (lastStopStringSuffix ?? "");

        if (promptIndex === 0 && systemPrompt != "") {
            return (getTextCompletion(previousCompletionEnd, "<s>[INST] <<SYS>>\n") ?? "<s>[INST] <<SYS>>\n") + systemPrompt +
                "\n<</SYS>>\n\n" + prompt + " [/INST]\n\n";
        } else {
            return (getTextCompletion(previousCompletionEnd, "</s><s>[INST] ") ?? "<s>[INST] ") + prompt + " [/INST]\n\n";
        }
    }

    public override getStopStrings(): string[] {
        return ["</s>"];
    }

    public override getDefaultStopString(): string {
        return "</s>";
    }
}
