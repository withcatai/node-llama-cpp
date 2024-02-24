import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfNull extends GbnfTerminal {
    public getGrammar(): string {
        return '"null"';
    }

    protected override getRuleName(): string {
        return reservedRuleNames.null;
    }
}
