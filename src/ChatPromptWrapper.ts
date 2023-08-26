export abstract class ChatPromptWrapper {
    public wrapPrompt(prompt: string, {systemPrompt, promptIndex}: {
        systemPrompt: string, promptIndex: number, lastStopString: string | null, lastStopStringSuffix: string | null
    }) {
        if (promptIndex === 0) {
            return systemPrompt + "\n" + prompt;
        } else {
            return prompt;
        }
    }

    public getStopStrings(): string[] {
        return [];
    }
}
