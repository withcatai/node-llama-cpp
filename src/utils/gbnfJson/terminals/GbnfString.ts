import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfString extends GbnfTerminal {
    public getGrammar(): string {
        return [
            '"\\""',
            or([
                negatedCharacterSet([
                    '"',
                    "\\\\",
                    "\\x7F",
                    "\\x00-\\x1F"
                ]),

                // escape sequences
                '"\\\\" ' + or([
                    '["\\\\/bfnrt]',
                    '"u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]'
                ])
            ]) + "*",
            '"\\""'
        ].join(" ");
    }

    protected override getRuleName(): string {
        return reservedRuleNames.string;
    }
}

function negatedCharacterSet(characterDefinitions: string[]) {
    return "[^" + characterDefinitions.join("") + "]";
}

function or(definitions: string[]) {
    return "(" + definitions.join(" | ") + ")";
}
