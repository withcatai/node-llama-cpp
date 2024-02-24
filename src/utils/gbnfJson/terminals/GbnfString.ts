import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfString extends GbnfTerminal {
    public getGrammar(): string {
        return '"\\"" ( ' +
            '[^"\\\\]' +
            " | " +
            '"\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])' + // escape sequences
            ')* "\\""';
    }

    protected override getRuleName(): string {
        return reservedRuleNames.string;
    }
}
