import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {reservedRuleNames} from "./gbnfConsts.js";
import {GbnfRepetition} from "./GbnfRepetition.js";
import {GbnfInsideStringChar} from "./GbnfInsideStringChar.js";


export class GbnfString extends GbnfTerminal {
    public readonly minLength: number;
    public readonly maxLength?: number;

    public constructor({
        minLength = 0,
        maxLength
    }: {
        minLength?: number,
        maxLength?: number
    } = {}) {
        super();

        this.minLength = Math.floor(minLength ?? 0);
        this.maxLength = maxLength == null ? undefined : Math.floor(maxLength);

        if (this.minLength < 0)
            this.minLength = 0;

        if (this.maxLength != null && this.maxLength < this.minLength)
            this.maxLength = this.minLength;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        if (this.minLength == 0 && this.maxLength == null)
            return [
                '"\\""',
                new GbnfInsideStringChar().resolve(grammarGenerator) + "*",
                '"\\""'
            ].join(" ");
        else if (this.minLength == 0 && this.maxLength == 0)
            return '"\\"\\""';

        return [
            '"\\""',
            new GbnfRepetition({
                value: new GbnfInsideStringChar(),
                minRepetitions: this.minLength,
                maxRepetitions: this.maxLength
            }).getGrammar(grammarGenerator),
            '"\\""'
        ].join(" ");
    }

    protected override getRuleName(): string {
        return reservedRuleNames.string({
            minLength: this.minLength,
            maxLength: this.maxLength
        });
    }
}
