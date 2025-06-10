import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";


export class GbnfGrammar extends GbnfTerminal {
    public readonly grammar: string | string[];
    public readonly resolveToRawGrammar: boolean;

    public constructor(grammar: string | string[], resolveToRawGrammar: boolean = false) {
        super();
        this.grammar = grammar;
        this.resolveToRawGrammar = resolveToRawGrammar;
    }

    public getGrammar(): string {
        if (this.grammar instanceof Array)
            return this.grammar
                .filter((item) => item !== "")
                .join(" ");

        return this.grammar;
    }

    public override resolve(grammarGenerator: GbnfGrammarGenerator, resolveAsRootGrammar: boolean = false): string {
        if (this.resolveToRawGrammar)
            return this.getGrammar();

        return super.resolve(grammarGenerator, resolveAsRootGrammar);
    }
}
