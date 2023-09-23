import {ChatPromptWrapper} from "../ChatPromptWrapper.js";
import {getTextCompletion} from "../utils/getTextCompletion.js";

export class FalconChatPromptWrapper extends ChatPromptWrapper {
    public readonly wrapperName: string = "Falcon";
    private readonly _instructionName: string;
    private readonly _responseName: string;

    public constructor({instructionName = "User", responseName = "Assistant"}: {instructionName?: string, responseName?: string} = {}) {
        super();

        this._instructionName = instructionName;
        this._responseName = responseName;
    }

    public override wrapPrompt(prompt: string, {systemPrompt, promptIndex, lastStopString, lastStopStringSuffix}: {
        systemPrompt: string, promptIndex: number, lastStopString: string | null, lastStopStringSuffix: string | null
    }) {
        if (promptIndex === 0)
            return systemPrompt + `\n${this._instructionName}: ` + prompt + `\n${this._responseName}: `;

        return this._getPromptPrefix(lastStopString, lastStopStringSuffix) + prompt + `\n${this._responseName}: `;
    }

    public override getStopStrings(): string[] {
        return [
            `\n${this._instructionName}: `,
            `\n${this._responseName}:`
        ];
    }

    public override getDefaultStopString(): string {
        return `\n${this._instructionName}: `;
    }

    private _getPromptPrefix(lastStopString: string | null, lastStopStringSuffix: string | null) {
        return getTextCompletion((lastStopString ?? "") + (lastStopStringSuffix ?? ""), [
            `\n${this._instructionName}: `,
            `${this._instructionName}: `
        ]) ?? `\n${this._instructionName}: `;
    }
}
