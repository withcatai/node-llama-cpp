import {MultiKeyMap} from "lifecycle-utils";
import {GbnfJsonSchema} from "./types.js";

export class GbnfGrammarGenerator {
    public rules = new Map<string, string>();
    public ruleContentToRuleName = new Map<string, string>();
    public literalValueRuleNames = new Map<string | number, string>();
    public defRuleNames = new MultiKeyMap<[string, GbnfJsonSchema], string | null>();
    public defScopeDefs = new MultiKeyMap<[string, GbnfJsonSchema], Record<string, GbnfJsonSchema>>();
    public usedRootRuleName: boolean = false;
    private ruleId: number = 0;
    private valueRuleId: number = 0;
    private defRuleId: number = 0;

    public generateRuleName() {
        const ruleId = this.ruleId;
        this.ruleId++;

        return `rule${ruleId}`;
    }

    public generateRuleNameForLiteralValue(value: string | number) {
        const existingRuleName = this.literalValueRuleNames.get(value);
        if (existingRuleName != null)
            return existingRuleName;

        const ruleName = `val${this.valueRuleId}`;
        this.valueRuleId++;

        this.literalValueRuleNames.set(value, ruleName);

        return ruleName;
    }

    public generateRuleNameForDef(defName: string, def: GbnfJsonSchema): string {
        const existingRuleName = this.defRuleNames.get([defName, def]);
        if (existingRuleName != null)
            return existingRuleName;

        const ruleName = `def${this.defRuleId}`;
        this.defRuleId++;

        this.defRuleNames.set([defName, def], ruleName);

        return ruleName;
    }

    public registerDefs(scopeDefs: Record<string, GbnfJsonSchema>) {
        for (const [defName, def] of Object.entries(scopeDefs))
            this.defScopeDefs.set([defName, def], scopeDefs);
    }

    public generateGbnfFile(rootGrammar: string) {
        const rules: {name: string, grammar: string}[] = [{
            name: "root",
            grammar: rootGrammar
        }];

        for (const [ruleName, grammar] of this.rules.entries()) {
            if (grammar == null)
                continue;

            rules.push({
                name: ruleName,
                grammar
            });
        }

        const ruleStrings = rules.map((rule) => rule.name + " ::= " + rule.grammar);
        const gbnf = ruleStrings.join("\n");

        return gbnf;
    }

    public getProposedLiteralValueRuleNameLength() {
        return `val${this.valueRuleId}`.length;
    }
}
