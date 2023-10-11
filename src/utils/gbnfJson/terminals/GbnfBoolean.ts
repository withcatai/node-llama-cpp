import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfOr} from "./GbnfOr.js";
import {GbnfGrammar} from "./GbnfGrammar.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfBoolean extends GbnfTerminal {
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        return new GbnfOr([
            new GbnfGrammar('"true"'),
            new GbnfGrammar('"false"')
        ]).getGrammar(grammarGenerator);
    }

    override getRuleName(): string {
        return reservedRuleNames.boolean;
    }
}
