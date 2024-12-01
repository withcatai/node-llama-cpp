import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";


export class GbnfStringValue extends GbnfTerminal {
    public readonly value: string;

    public constructor(value: string) {
        super();
        this.value = value;
    }

    public override getGrammar(): string {
        return [
            '"',
            '\\"',
            this.value
                .replaceAll("\\", "\\\\\\\\")
                .replaceAll("\t", "\\\\t")
                .replaceAll("\r", "\\\\r")
                .replaceAll("\n", "\\\\n")
                .replaceAll('"', "\\\\" + '\\"'),
            '\\"',
            '"'
        ].join("");
    }

    protected override generateRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        return grammarGenerator.generateRuleNameForLiteralValue(this.value);
    }
}
