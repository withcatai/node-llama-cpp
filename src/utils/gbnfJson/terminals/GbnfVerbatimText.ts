import {GbnfTerminal} from "../GbnfTerminal.js";


export class GbnfVerbatimText extends GbnfTerminal {
    public readonly value: string;

    public constructor(value: string) {
        super();
        this.value = value;
    }

    public override getGrammar(): string {
        return [
            '"',
            this.value
                .replaceAll("\\", "\\\\")
                .replaceAll('"', '\\"')
                .replaceAll("\t", "\\t")
                .replaceAll("\r", "\\r")
                .replaceAll("\n", "\\n"),
            '"'
        ].join("");
    }
}
