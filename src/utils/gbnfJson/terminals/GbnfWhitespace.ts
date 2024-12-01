import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfJsonScopeState} from "../utils/GbnfJsonScopeState.js";
import {reservedRuleNames} from "./gbnfConsts.js";
import {GbnfVerbatimText} from "./GbnfVerbatimText.js";


export class GbnfWhitespace extends GbnfTerminal {
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
        return this._getGrammar();
    }

    protected override getGrammarFromResolve(): string {
        return this._getGrammar(false);
    }

    private _getGrammar(wrap: boolean = true): string {
        if (this.scopeState.settings.allowNewLines && this.newLine !== false) {
            const values = [
                ...(
                    this.newLine === "before"
                        ? ["[\\n]"]
                        : []
                ),
                ...(
                    this.scopeState.currentNestingScope === 0
                        ? []
                        : [
                            or([
                                verbatimTextRepetition(" ", this.scopeState.currentNestingScope * this.scopeState.settings.scopePadSpaces),
                                verbatimTextRepetition("\t", this.scopeState.currentNestingScope)
                            ])
                        ]
                ),
                ...(
                    this.newLine === "after"
                        ? ["[\\n]"]
                        : []
                )
            ];

            return or([
                values.join(" "),
                "[ ]?"
            ], wrap);
        }

        return "[ ]?";
    }

    protected override getRuleName(): string {
        return reservedRuleNames.whitespace({
            newLine: this.scopeState.settings.allowNewLines
                ? this.newLine
                : false,
            scopeSpaces: this.scopeState.settings.scopePadSpaces,
            nestingScope: this.scopeState.currentNestingScope
        });
    }
}

function or(definitions: string[], wrap: boolean = true) {
    if (!wrap)
        return definitions.join(" | ");

    return "(" + definitions.join(" | ") + ")";
}

function verbatimTextRepetition(text: string, count: number) {
    const textRepetitionGrammar = new GbnfVerbatimText(text.repeat(count)).getGrammar();

    if (count <= 1)
        return textRepetitionGrammar;

    const textRepetitionGrammarWithRepetition = new GbnfVerbatimText(text).getGrammar() + "{" + count + "}";
    if (textRepetitionGrammarWithRepetition.length < textRepetitionGrammar.length)
        return textRepetitionGrammarWithRepetition;

    return textRepetitionGrammar;
}
