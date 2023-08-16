import {ChatPromptWrapper} from "../ChatPromptWrapper.js";

export class GeneralChatPromptWrapper extends ChatPromptWrapper {
    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex}: { systemPrompt: string, promptIndex: number }) {
        const conversationPrompt = "\n\n### Human:\n\n" + prompt + "\n\n### Assistant:\n\n";

        return promptIndex === 0 ? systemPrompt + conversationPrompt : conversationPrompt;
    }

    public override getStopStrings(): string[] {
        return ["### Human:", "Human:", "### Assistant:", "Assistant:", "<end>"];
    }
}
