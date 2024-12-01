import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfJsonScopeState} from "../utils/GbnfJsonScopeState.js";
import {GbnfString} from "./GbnfString.js";
import {GbnfOr} from "./GbnfOr.js";
import {GbnfNumber} from "./GbnfNumber.js";
import {GbnfBoolean} from "./GbnfBoolean.js";
import {GbnfNull} from "./GbnfNull.js";
import {GbnfArray} from "./GbnfArray.js";
import {reservedRuleNames} from "./gbnfConsts.js";
import {GbnfObjectMap} from "./GbnfObjectMap.js";


export class GbnfAnyJson extends GbnfTerminal {
    public readonly scopeState: GbnfJsonScopeState;

    public constructor(scopeState: GbnfJsonScopeState = new GbnfJsonScopeState()) {
        super();

        this.scopeState = scopeState;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const subAnyJsonScopeItem = this.scopeState.settings.allowNewLines
            ? new GbnfAnyJson(
                new GbnfJsonScopeState({
                    allowNewLines: false,
                    scopePadSpaces: this.scopeState.settings.scopePadSpaces
                }, this.scopeState.currentNestingScope)
            )
            : new GbnfSubAnyJson(this.scopeState);

        return new GbnfOr([
            new GbnfString(),
            new GbnfNumber({allowFractional: true}),
            new GbnfBoolean(),
            new GbnfNull(),
            new GbnfArray({
                items: subAnyJsonScopeItem,
                scopeState: this.scopeState
            }),
            new GbnfObjectMap({
                fields: [],
                additionalProperties: subAnyJsonScopeItem,
                scopeState: this.scopeState
            })
        ]).getGrammar(grammarGenerator);
    }

    protected override getRuleName(): string {
        return reservedRuleNames.anyJson({
            allowNewLines: this.scopeState.settings.allowNewLines,
            scopeSpaces: this.scopeState.settings.scopePadSpaces,
            nestingScope: this.scopeState.currentNestingScope
        });
    }
}

class GbnfSubAnyJson extends GbnfAnyJson {
    public override getGrammar(): string {
        return this.getRuleName();
    }
}
