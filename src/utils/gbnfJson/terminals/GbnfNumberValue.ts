import {GbnfTerminal} from "../GbnfTerminal.js";


export class GbnfNumberValue extends GbnfTerminal {
    public readonly value: number;

    public constructor(value: number) {
        super();
        this.value = value;
    }

    public override getGrammar(): string {
        return '"' + JSON.stringify(this.value) + '"';
    }

    public override resolve(): string {
        return this.getGrammar();
    }
}
