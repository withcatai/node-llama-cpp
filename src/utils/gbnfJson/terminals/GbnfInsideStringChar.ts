import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";

export class GbnfInsideStringChar extends GbnfTerminal {
    public getGrammar(): string {
        return [
            negatedCharacterSet([
                '"',
                "\\\\",
                "\\x7F",
                "\\x00-\\x1F"
            ]),

            // escape sequences
            '"\\\\" ["\\\\/bfnrt]',
            '"\\\\u" [0-9a-fA-F]{4}'
        ].join(" | ");
    }

    protected override getRuleName(): string {
        return reservedRuleNames.stringChar;
    }
}

function negatedCharacterSet(characterDefinitions: string[]) {
    return "[^" + characterDefinitions.join("") + "]";
}
