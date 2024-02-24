import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfWhitespace extends GbnfTerminal {
    public readonly newLinesAllowed: boolean;

    public constructor({newLinesAllowed = true}: { newLinesAllowed?: boolean } = {}) {
        super();
        this.newLinesAllowed = newLinesAllowed;
    }

    public getGrammar(): string {
        if (this.newLinesAllowed)
            return "[\\n]? [ \\t]* [\\n]?";

        return "[ \\t]*";
    }

    protected override getRuleName(): string {
        if (this.newLinesAllowed)
            return reservedRuleNames.whitespace.withNewLines;

        return reservedRuleNames.whitespace.withoutNewLines;
    }
}
