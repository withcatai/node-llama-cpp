import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";

// the control characters (U+0000 - U+001F) that a JSON string cannot contain unescaped,
// after `\t`, `\r`, `\n`, `\b` and `\f` were already replaced with their short escape sequence
const remainingControlCharactersRegex = /[\u0000-\u001f]/g;

function escapeControlCharacter(char: string): string {
    const hex = char.charCodeAt(0).toString(16);
    return "\\\\u" + hex.padStart(4, "0");
}

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
                .replaceAll("\b", "\\\\b")
                .replaceAll("\f", "\\\\f")
                .replaceAll(remainingControlCharactersRegex, escapeControlCharacter)
                .replaceAll('"', "\\\\" + '\\"'),
            '\\"',
            '"'
        ].join("");
    }

    protected override generateRuleName(grammarGenerator: GbnfGrammarGenerator): string {
        return grammarGenerator.generateRuleNameForLiteralValue(this.value);
    }
}
