import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfJsonSchema} from "../types.js";


export class GbnfRef extends GbnfTerminal {
    public readonly getValueTerminal: () => GbnfTerminal;
    public readonly defName: string;
    public readonly def: GbnfJsonSchema;

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
        return this.generateRuleName(grammarGenerator);
    }

    protected override generateRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        if (!grammarGenerator.defRuleNames.has([this.defName, this.def])) {
            const alreadyGeneratingGrammarForThisRef = grammarGenerator.defRuleNames.get([this.defName, this.def]) === null;
            if (alreadyGeneratingGrammarForThisRef)
                return grammarGenerator.generateRuleNameForDef(this.defName, this.def);

            grammarGenerator.defRuleNames.set([this.defName, this.def], null);
            const grammar = this.getValueTerminal().resolve(grammarGenerator);

            if (grammarGenerator.rules.has(grammar) && grammarGenerator.defRuleNames.get([this.defName, this.def]) === null) {
                grammarGenerator.defRuleNames.set([this.defName, this.def], grammar);
                return grammar;
            }

            const ruleName = grammarGenerator.generateRuleNameForDef(this.defName, this.def);
            grammarGenerator.rules.set(ruleName, grammar);
            grammarGenerator.ruleContentToRuleName.set(grammar, ruleName);

            return ruleName;
        }

        return grammarGenerator.generateRuleNameForDef(this.defName, this.def);
    }
}
