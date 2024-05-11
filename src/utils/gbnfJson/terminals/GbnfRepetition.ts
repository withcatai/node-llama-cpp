import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {grammarNoValue} from "./gbnfConsts.js";


export class GbnfRepetition extends GbnfTerminal {
    public readonly value: GbnfTerminal;
    public readonly minRepetitions: number;
    public readonly maxRepetitions: number | null;

    public constructor(value: GbnfTerminal, minRepetitions: number, maxRepetitions: number | null) {
        super();
        this.value = value;
        this.minRepetitions = minRepetitions;
        this.maxRepetitions = maxRepetitions;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const resolvedValue = this.value.resolve(grammarGenerator);
        let grammarStart = "";
        let grammarEnd = "";

        for (let i = 0; i < this.minRepetitions; i++) {
            grammarStart += "(" + resolvedValue + " ";
            grammarEnd += ")";
        }

        if (this.maxRepetitions === Infinity || this.maxRepetitions == null) {
            grammarStart += "(" + resolvedValue + " ";
            grammarEnd += ")*";
        } else {
            for (let i = this.minRepetitions + 1; i <= this.maxRepetitions; i++) {
                grammarStart += "(" + resolvedValue + " ";
                grammarEnd += ")?";
            }
        }

        const res = grammarStart + grammarEnd;

        if (res === "")
            return grammarNoValue;

        return res;
    }
}
