import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfJsonScopeState} from "../utils/GbnfJsonScopeState.js";
import {GbnfGrammar} from "./GbnfGrammar.js";
import {GbnfWhitespace} from "./GbnfWhitespace.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfCommaWhitespace extends GbnfTerminal {
    public readonly scopeState: GbnfJsonScopeState;
    public readonly newLine: "before" | "after" | false;

    public constructor(scopeState: GbnfJsonScopeState, {
        newLine = "before"
    }: {
        newLine?: "before" | "after" | false
    } = {}) {
        super();
        this.scopeState = scopeState;
        this.newLine = newLine;
    }

    public getGrammar(): string {
        return new GbnfGrammar([
            '","', new GbnfWhitespace(this.scopeState, {newLine: this.newLine}).getGrammar()
        ]).getGrammar();
    }

    protected override getRuleName(): string {
        return reservedRuleNames.commaWhitespace({
            newLine: this.scopeState.settings.allowNewLines
                ? this.newLine
                : false,
            scopeSpaces: this.scopeState.settings.scopePadSpaces,
            nestingScope: this.scopeState.currentNestingScope
        });
    }
}
