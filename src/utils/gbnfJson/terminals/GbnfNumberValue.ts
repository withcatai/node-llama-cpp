import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";


export class GbnfNumberValue extends GbnfTerminal {
    public readonly value: number;

    public constructor(value: number) {
        super();
        this.value = value;
    }

    public override getGrammar(): string {
        return '"' + JSON.stringify(this.value) + '"';
    }

    public override resolve(grammarGenerator: GbnfGrammarGenerator, resolveAsRootGrammar: boolean = false): string {
        const grammar = this.getGrammar();
        if (grammar.length <= grammarGenerator.getProposedLiteralValueRuleNameLength())
            return grammar;

        return super.resolve(grammarGenerator, resolveAsRootGrammar);
    }

    protected override generateRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        return grammarGenerator.generateRuleNameForLiteralValue(this.value);
    }
}
