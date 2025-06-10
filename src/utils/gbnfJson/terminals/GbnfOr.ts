import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {grammarNoValue} from "./gbnfConsts.js";


export class GbnfOr extends GbnfTerminal {
    public readonly values: readonly GbnfTerminal[];
    public readonly useRawGrammar: boolean;

    public constructor(values: readonly GbnfTerminal[], useRawGrammar: boolean = false) {
        super();
        this.values = values;
        this.useRawGrammar = useRawGrammar;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const mappedValues = this.values
            .map((v) => (
                this.useRawGrammar
                    ? v.getGrammar(grammarGenerator)
                    : v.resolve(grammarGenerator)
            ))
            .filter((value) => value !== "" && value !== grammarNoValue);

        if (mappedValues.length === 0)
            return grammarNoValue;
        else if (mappedValues.length === 1)
            return mappedValues[0]!;

        return "( " + mappedValues.join(" | ") + " )";
    }

    public override resolve(grammarGenerator: GbnfGrammarGenerator, resolveAsRootGrammar: boolean = false): string {
        const mappedValues = this.values
            .map((v) => v.resolve(grammarGenerator))
            .filter((value) => value !== "" && value !== grammarNoValue);

        if (mappedValues.length === 0)
            return grammarNoValue;
        else if (mappedValues.length === 1)
            return mappedValues[0]!;

        return super.resolve(grammarGenerator, resolveAsRootGrammar);
    }
}
