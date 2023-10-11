import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfString extends GbnfTerminal {
    getGrammar(): string {
        return '"\\"" ( ' +
            '[^"\\\\]' +
            " | " +
            '"\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])' + // escape sequences
            ')* "\\""';
    }

    override getRuleName(): string {
        return reservedRuleNames.string;
    }
}
