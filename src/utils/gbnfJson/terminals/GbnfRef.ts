import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfJsonSchema} from "../types.js";


export class GbnfRef extends GbnfTerminal {
    public readonly getValueTerminal: () => GbnfTerminal;
    public readonly defName: string;
    public readonly def: GbnfJsonSchema;
    private _valueTerminal?: GbnfTerminal;
    private _grammar?: string;

    public constructor({
        getValueTerminal,
        defName,
        def
    }: {
        getValueTerminal: () => GbnfTerminal,
        defName: string,
        def: GbnfJsonSchema
    }) {
        super();
        this.getValueTerminal = getValueTerminal;
        this.defName = defName;
        this.def = def;
    }

    public override getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        this._createRule(grammarGenerator);

        if (this._valueTerminal != null)
            return this._valueTerminal.getGrammar(grammarGenerator);
        else if (this._grammar != null)
            return this._grammar;

        return this.getValueTerminal().getGrammar(grammarGenerator);
    }

    protected override generateRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        return this._createRule(grammarGenerator);
    }

    private _createRule(grammarGenerator: GbnfGrammarGenerator) {
        const [isNew, ruleName] = grammarGenerator.generateRuleNameForDef(this.defName, this.def);
        if (!isNew) {
            this._grammar = ruleName;
            return ruleName;
        }

        this._valueTerminal = this.getValueTerminal();
        return ruleName;
    }
}
