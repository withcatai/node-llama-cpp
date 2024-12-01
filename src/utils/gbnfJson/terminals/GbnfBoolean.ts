import {GbnfTerminal} from "../GbnfTerminal.js";
import {reservedRuleNames} from "./gbnfConsts.js";


export class GbnfBoolean extends GbnfTerminal {
    public getGrammar(): string {
        return this._getGrammar();
    }

    protected override getGrammarFromResolve(): string {
        return this._getGrammar(false);
    }

    private _getGrammar(wrap: boolean = true): string {
        const values: string[] = ['"true"', '"false"'];

        if (wrap)
            return [
                "(", values.join(" | "), ")"
            ].join(" ");

        return values.join(" | ");
    }

    protected override getRuleName(): string {
        return reservedRuleNames.boolean;
    }
}
