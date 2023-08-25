import {ChatPromptWrapper} from "../ChatPromptWrapper.js";

// source: https://huggingface.co/blog/llama2#how-to-prompt-llama-2
export class LlamaChatPromptWrapper extends ChatPromptWrapper {
    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex}: {systemPrompt: string, promptIndex: number}) {
        if (promptIndex === 0 && systemPrompt != "") {
            return "<s>[INST] <<SYS>>\n" + systemPrompt + "\n<</SYS>>\n\n" + prompt + " [/INST]\n\n";
        } else {
            return "<s>[INST] " + prompt + " [/INST]\n\n";
        }
    }

    public override getStopStrings(): string[] {
        return ["</s><s>[INST]"];
    }
}
