import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfJsonScopeState} from "../utils/GbnfJsonScopeState.js";
import {GbnfString} from "./GbnfString.js";
import {GbnfStringValue} from "./GbnfStringValue.js";
import {GbnfWhitespace} from "./GbnfWhitespace.js";
import {GbnfGrammar} from "./GbnfGrammar.js";


export class GbnfObjectMap extends GbnfTerminal {
    public readonly fields: Array<Readonly<{ key: GbnfString | GbnfStringValue, value: GbnfTerminal, required: true }>>;
    public readonly scopeState: GbnfJsonScopeState;

    public constructor(
        fields: Array<Readonly<{ key: GbnfString | GbnfStringValue, value: GbnfTerminal, required: true }>>,
        scopeState: GbnfJsonScopeState = new GbnfJsonScopeState()
    ) {
        super();

        this.fields = fields;
        this.scopeState = scopeState;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const getWhitespaceRuleName = (newScope: boolean, newLine: "before" | "after" | false) => (
            newScope
                ? new GbnfWhitespace(this.scopeState.getForNewScope(), {newLine}).resolve(grammarGenerator)
                : new GbnfWhitespace(this.scopeState, {newLine}).resolve(grammarGenerator)
        );

        return new GbnfGrammar([
            '"{"', getWhitespaceRuleName(true, "before"),
            ...this.fields.map(({key, value}, index) => {
                return new GbnfGrammar([
                    key.getGrammar(), '":"', "[ ]?", value.resolve(grammarGenerator),
                    index < this.fields.length - 1 ? '","' : "",
                    getWhitespaceRuleName(index < this.fields.length - 1, "before")
                ]).getGrammar();
            }),
            '"}"'
        ]).getGrammar();
    }
}
