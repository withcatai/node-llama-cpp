export class GbnfGrammarGenerator {
    public rules = new Map<string, string | null>();
    private ruleId: number = 0;

    public generateRuleName() {
        const ruleId = this.ruleId;
        this.ruleId++;

        return `rule${ruleId}`;
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
}
