import {ChatPromptWrapper} from "../ChatPromptWrapper.js";
import {getTextCompletion} from "../utils/getTextCompletion.js";

export class GeneralChatPromptWrapper extends ChatPromptWrapper {
    public readonly wrapperName: string = "General";
    private readonly _instructionName: string;
    private readonly _responseName: string;

    public constructor({instructionName = "Human", responseName = "Assistant"}: {instructionName?: string, responseName?: string} = {}) {
        super();

        this._instructionName = instructionName;
        this._responseName = responseName;
    }

    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex, lastStopString, lastStopStringSuffix}: {
        systemPrompt: string, promptIndex: number, lastStopString: string | null, lastStopStringSuffix: string | null
    }) {
        if (promptIndex === 0)
            return systemPrompt + `\n\n### ${this._instructionName}:\n` + prompt + `\n\n### ${this._responseName}:\n`;

        return this._getPromptPrefix(lastStopString, lastStopStringSuffix) + prompt + `\n\n### ${this._responseName}:\n`;
    }

    public override getStopStrings(): string[] {
        return [
            `\n\n### ${this._instructionName}`,
            `### ${this._instructionName}`,
            `\n\n### ${this._responseName}`,
            `### ${this._responseName}`,
            "<end>"
        ];
    }

    public override getDefaultStopString(): string {
        return `\n\n### ${this._instructionName}`;
    }

    private _getPromptPrefix(lastStopString: string | null, lastStopStringSuffix: string | null) {
        return getTextCompletion(
            lastStopString === "<end>"
                ? lastStopStringSuffix
                : ((lastStopString ?? "") + (lastStopStringSuffix ?? "")),
            [
                `\n\n### ${this._instructionName}:\n`,
                `### ${this._instructionName}:\n`
            ]
        ) ?? `\n\n### ${this._instructionName}:\n`;
    }
}
