import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfNumber extends GbnfTerminal {
    public readonly allowFractional: boolean;

    public constructor({allowFractional = true}: { allowFractional: boolean }) {
        super();
        this.allowFractional = allowFractional;
    }

    public getGrammar(): string {
        const numberGrammar = '("-"? ([0-9] | [1-9] [0-9]*))';

        if (this.allowFractional)
            return numberGrammar + ' ("." [0-9]+)? ([eE] [-+]? [0-9]+)?';

        return numberGrammar;
    }

    protected override getRuleName(): string {
        if (this.allowFractional)
            return reservedRuleNames.number.fractional;

        return reservedRuleNames.number.integer;
    }
}
