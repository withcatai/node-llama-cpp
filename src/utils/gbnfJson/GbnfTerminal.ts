import {GbnfGrammarGenerator} from "./GbnfGrammarGenerator.js";


export abstract class GbnfTerminal {
    private _ruleName: string | null = null;

    /** To be used only by `getRuleName` */
    protected generateRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        return grammarGenerator.generateRuleName();
    }

    protected getRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        if (this._ruleName != null)
            return this._ruleName;

        const ruleName = this.generateRuleName(grammarGenerator);
        this._ruleName = ruleName;

        return ruleName;
    }

    public abstract getGrammar(grammarGenerator: GbnfGrammarGenerator): string;

    public resolve(grammarGenerator: GbnfGrammarGenerator): string {
        if (this._ruleName != null)
            return this._ruleName;

        const grammar = this.getGrammar(grammarGenerator);

        const existingRuleName = grammarGenerator.ruleContentToRuleName.get(grammar);
        if (existingRuleName != null) {
            this._ruleName = existingRuleName;
            return existingRuleName;
        }

        const ruleName = this.getRuleName(grammarGenerator);

        if (grammar === ruleName) {
            this._ruleName = ruleName;
            return ruleName;
        }

        if (!grammarGenerator.rules.has(ruleName)) {
            grammarGenerator.rules.set(ruleName, grammar);
            grammarGenerator.ruleContentToRuleName.set(grammar, ruleName);
        }

        this._ruleName = ruleName;
        return ruleName;
    }
}
