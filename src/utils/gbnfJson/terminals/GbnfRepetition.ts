import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfGrammar} from "./GbnfGrammar.js";
import {grammarNoValue} from "./gbnfConsts.js";


export class GbnfRepetition extends GbnfTerminal {
    public readonly value: GbnfTerminal;
    public readonly separator?: GbnfTerminal;
    public readonly minRepetitions: number;
    public readonly maxRepetitions: number | null;

    public constructor({value, separator, minRepetitions = 0, maxRepetitions}: {
        value: GbnfTerminal, separator?: GbnfTerminal, minRepetitions?: number, maxRepetitions?: number | null
    }) {
        super();
        this.value = value;
        this.separator = separator;
        this.minRepetitions = Math.floor(minRepetitions);
        this.maxRepetitions = maxRepetitions == null ? null : Math.floor(maxRepetitions);

        if (this.minRepetitions < 0)
            this.minRepetitions = 0;

        if (this.maxRepetitions != null && this.maxRepetitions < 0)
            this.maxRepetitions = 0;

        if (this.maxRepetitions != null && this.maxRepetitions < this.minRepetitions)
            this.maxRepetitions = this.minRepetitions;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        if (this.maxRepetitions === 0)
            return grammarNoValue;

        const resolvedValue = this.value.resolve(grammarGenerator);
        const resolvedSeparator = this.separator?.resolve(grammarGenerator);

        if (this.minRepetitions === 0 && this.maxRepetitions == 1)
            return new GbnfGrammar(["(", resolvedValue, ")?"]).getGrammar();
        else if (this.minRepetitions === 1 && this.maxRepetitions === 1)
            return resolvedValue;
        else if (this.minRepetitions === this.maxRepetitions) {
            if (resolvedSeparator == null)
                return new GbnfGrammar(["(", resolvedValue, "){" + String(this.minRepetitions) + "}"]).getGrammar();

            if (this.minRepetitions === 2)
                return new GbnfGrammar([resolvedValue, resolvedSeparator, resolvedValue]).getGrammar();

            return new GbnfGrammar([
                resolvedValue, "(", resolvedSeparator, resolvedValue, "){" + String(this.minRepetitions - 1) + "}"
            ]).getGrammar();
        } else if (this.minRepetitions === 0 && this.maxRepetitions == null) {
            if (resolvedSeparator == null)
                return new GbnfGrammar(["(", resolvedValue, ")*"]).getGrammar();

            return new GbnfGrammar([
                "(", resolvedValue, "(", resolvedSeparator, resolvedValue, ")*", ")?"
            ]).getGrammar();
        } else if (this.minRepetitions === 1 && this.maxRepetitions == null) {
            if (resolvedSeparator == null)
                return new GbnfGrammar(["(", resolvedValue, ")+"]).getGrammar();

            return new GbnfGrammar([
                resolvedValue, "(", resolvedSeparator, resolvedValue, ")*"
            ]).getGrammar();
        } else if (this.maxRepetitions == null) {
            if (resolvedSeparator == null)
                return new GbnfGrammar(["(", resolvedValue, "){" + String(this.minRepetitions) + ",}"]).getGrammar();

            return new GbnfGrammar([
                resolvedValue, "(", resolvedSeparator, resolvedValue, "){" + String(this.minRepetitions - 1) + ",}"
            ]).getGrammar();
        }

        if (resolvedSeparator == null)
            return new GbnfGrammar(["(", resolvedValue, "){" + String(this.minRepetitions) + "," + String(this.maxRepetitions) + "}"]).getGrammar();

        if (this.minRepetitions === 0) {
            if (this.maxRepetitions === 2)
                return new GbnfGrammar([
                    "(", resolvedValue, "(", resolvedSeparator, resolvedValue, ")?", ")?"
                ]).getGrammar();

            return new GbnfGrammar([
                "(", resolvedValue, "(", resolvedSeparator, resolvedValue, "){0," + String(this.maxRepetitions - 1) + "}", ")?"
            ]).getGrammar();
        } else if (this.minRepetitions === 1) {
            if (this.maxRepetitions === 2)
                return new GbnfGrammar([
                    resolvedValue, "(", resolvedSeparator, resolvedValue, ")?"
                ]).getGrammar();

            return new GbnfGrammar([
                resolvedValue, "(", resolvedSeparator, resolvedValue, "){0," + String(this.maxRepetitions - 1) + "}"
            ]).getGrammar();
        }

        return new GbnfGrammar([
            resolvedValue, "(", resolvedSeparator, resolvedValue, "){" + String(this.minRepetitions - 1) + "," + String(this.maxRepetitions - 1) + "}"
        ]).getGrammar();
    }
}
