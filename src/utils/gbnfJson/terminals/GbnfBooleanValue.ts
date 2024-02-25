import {GbnfTerminal} from "../GbnfTerminal.js";


export class GbnfBooleanValue extends GbnfTerminal {
    public readonly value: boolean;

    public constructor(value: boolean) {
        super();
        this.value = value;
    }

    public getGrammar(): string {
        if (this.value)
            return '"true"';

        return '"false"';
    }

    public override resolve(): string {
        return this.getGrammar();
    }
}
