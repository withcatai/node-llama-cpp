export class GbnfGrammarGenerator {
    public rules = new Map<string, string | null>();
    private ruleId: number = 0;

    public generateRuleName() {
        const ruleId = this.ruleId;
        this.ruleId++;

        return `rule${ruleId}`;
    }
}
