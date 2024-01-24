export abstract class ChatPromptWrapper {
    public abstract readonly wrapperName: string;

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

    public getDefaultStopString(): string {
        const stopString = this.getStopStrings()[0];

        if (stopString == null || stopString.length === 0)
            throw new Error(`Prompt wrapper "${this.wrapperName}" has no stop strings`);

        return stopString;
    }
}
