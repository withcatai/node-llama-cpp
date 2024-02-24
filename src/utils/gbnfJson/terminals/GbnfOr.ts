import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {grammarNoValue} from "./gbnfConsts.js";


export class GbnfOr extends GbnfTerminal {
    public readonly values: readonly GbnfTerminal[];

    public constructor(values: readonly GbnfTerminal[]) {
        super();
        this.values = values;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const mappedValues = this.values
            .map(v => v.resolve(grammarGenerator))
            .filter(value => value !== "" && value !== grammarNoValue);

        if (mappedValues.length === 0)
            return grammarNoValue;
        else if (mappedValues.length === 1)
            return mappedValues[0];

        return "( " + mappedValues.join(" | ") + " )";
    }

    public override resolve(grammarGenerator: GbnfGrammarGenerator): string {
        const mappedValues = this.values
            .map(v => v.resolve(grammarGenerator))
            .filter(value => value !== "" && value !== grammarNoValue);

        if (mappedValues.length === 0)
            return grammarNoValue;
        else if (mappedValues.length === 1)
            return mappedValues[0];

        return super.resolve(grammarGenerator);
    }
}
