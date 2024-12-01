export class GbnfGrammarGenerator {
    public rules = new Map<string, string | null>();
    public ruleContentToRuleName = new Map<string, string>();
    public literalValueRuleNames = new Map<string | number, string>();
    private ruleId: number = 0;
    private valueRuleId: number = 0;

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
