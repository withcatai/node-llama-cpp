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
        newLine?: "before" | "after" | false,
        space?: boolean
    } = {}) {
        super();
        this.scopeState = scopeState;
        this.newLine = newLine;
    }

    public getGrammar(): string {
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
                                new GbnfVerbatimText(
                                    " ".repeat(this.scopeState.currentNestingScope * this.scopeState.settings.scopePadSpaces)
                                ).getGrammar(),
                                new GbnfVerbatimText(
                                    "\t".repeat(this.scopeState.currentNestingScope)
                                ).getGrammar()
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
            ]);
        }

        return "[ ]?";
    }

    protected override getRuleName(): string {
        return reservedRuleNames.whitespace({
            newLine: this.newLine,
            scopeSpaces: this.scopeState.settings.scopePadSpaces,
            nestingScope: this.scopeState.currentNestingScope
        });
    }
}

function or(definitions: string[]) {
    return "(" + definitions.join(" | ") + ")";
}
