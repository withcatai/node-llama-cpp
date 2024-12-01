import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfJsonFormatStringSchema} from "../types.js";
import {reservedRuleNames} from "./gbnfConsts.js";
import {GbnfGrammar} from "./GbnfGrammar.js";
import {GbnfString} from "./GbnfString.js";


export class GbnfFormatString extends GbnfTerminal {
    public readonly format: GbnfJsonFormatStringSchema["format"];

    public constructor(format: GbnfJsonFormatStringSchema["format"]) {
        super();

        this.format = format;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const quote = '"\\""';
        if (this.format === "date")
            return new GbnfGrammar([
                quote,
                this._getDateGrammar(),
                quote
            ]).getGrammar();
        else if (this.format === "time") {
            return new GbnfGrammar([
                quote,
                this._getTimeGrammar(),
                quote
            ]).getGrammar();
        } else if (this.format === "date-time")
            return new GbnfGrammar([
                quote,
                this._getDateGrammar(),
                '"T"',
                this._getTimeGrammar(),
                quote
            ]).getGrammar();

        return new GbnfString({
            minLength: 0,
            maxLength: 0
        }).resolve(grammarGenerator);
    }

    protected override getRuleName(): string {
        return reservedRuleNames.formatString(this.format);
    }

    private _getDateGrammar(): string {
        return new GbnfGrammar([
            "[0-9]{4}",
            '"-"',
            or([
                '"0" [1-9]',
                '"1" [012]'
            ]),
            '"-"',
            or([
                '"0" [1-9]',
                "[12] [0-9]",
                '"3" [01]'
            ])
        ]).getGrammar();
    }

    private _getTimeGrammar(): string {
        return new GbnfGrammar([
            or([
                "[01] [0-9]",
                '"2" [0-3]'
            ]),
            '":"',
            "[0-5] [0-9]",
            '":"',
            "[0-5] [0-9]",
            '( "." [0-9]{3} )?',
            or([
                '"Z"',
                new GbnfGrammar([
                    or([
                        '"+"',
                        '"-"'
                    ]),
                    or([
                        "[01] [0-9]",
                        '"2" [0-3]'
                    ]),
                    '":"',
                    "[0-5] [0-9]"
                ]).getGrammar()
            ])
        ]).getGrammar();
    }
}

function or(values: string[]) {
    return "(" + values.join(" | ") + ")";
}
