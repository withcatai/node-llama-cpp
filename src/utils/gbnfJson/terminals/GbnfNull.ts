import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfNull extends GbnfTerminal {
    getGrammar(): string {
        return '"null"';
    }

    override getRuleName(): string {
        return reservedRuleNames.null;
    }
}
