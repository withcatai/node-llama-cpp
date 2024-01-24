import {GbnfGrammarGenerator} from "./GbnfGrammarGenerator.js";


export abstract class GbnfTerminal {
    private _ruleName: string | null = null;

    public getRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        if (this._ruleName != null)
            return this._ruleName;

        const ruleName = grammarGenerator.generateRuleName();
        this._ruleName = ruleName;

        return ruleName;
    }

    abstract getGrammar(grammarGenerator: GbnfGrammarGenerator): string;

    public resolve(grammarGenerator: GbnfGrammarGenerator): string {
        const ruleName = this.getRuleName(grammarGenerator);

        if (!grammarGenerator.rules.has(ruleName))
            grammarGenerator.rules.set(ruleName, this.getGrammar(grammarGenerator));

        return ruleName;
    }
}
