import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfJsonScopeState} from "../utils/GbnfJsonScopeState.js";
import {GbnfWhitespace} from "./GbnfWhitespace.js";
import {GbnfGrammar} from "./GbnfGrammar.js";
import {GbnfOr} from "./GbnfOr.js";


export class GbnfArray extends GbnfTerminal {
    public readonly items: GbnfTerminal;
    public readonly scopeState: GbnfJsonScopeState;

    public constructor(items: GbnfTerminal, scopeState: GbnfJsonScopeState = new GbnfJsonScopeState()) {
        super();

        this.items = items;
        this.scopeState = scopeState;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const getWhitespaceRuleName = (newScope: boolean, newLine: "before" | "after" | false) => (
            newScope
                ? new GbnfWhitespace(this.scopeState.getForNewScope(), {newLine}).resolve(grammarGenerator)
                : new GbnfWhitespace(this.scopeState, {newLine}).resolve(grammarGenerator)
        );
        const itemsGrammarRuleName = this.items.resolve(grammarGenerator);

        return new GbnfGrammar([
            '"["', getWhitespaceRuleName(true, "before"),
            new GbnfOr([
                new GbnfGrammar([
                    "(", itemsGrammarRuleName, ")",
                    "(", '","', getWhitespaceRuleName(true, "before"), itemsGrammarRuleName, ")*"
                ]),
                new GbnfGrammar([
                    "(", itemsGrammarRuleName, ")?"
                ])
            ]).getGrammar(grammarGenerator),
            getWhitespaceRuleName(false, "before"), '"]"'
        ]).getGrammar();
    }
}
