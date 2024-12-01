import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfJsonScopeState} from "../utils/GbnfJsonScopeState.js";
import {GbnfString} from "./GbnfString.js";
import {GbnfStringValue} from "./GbnfStringValue.js";
import {GbnfWhitespace} from "./GbnfWhitespace.js";
import {GbnfGrammar} from "./GbnfGrammar.js";
import {GbnfRepetition} from "./GbnfRepetition.js";
import {GbnfCommaWhitespace} from "./GbnfCommaWhitespace.js";


export class GbnfObjectMap extends GbnfTerminal {
    public readonly fields: Array<Readonly<{key: GbnfString | GbnfStringValue, value: GbnfTerminal, required: true}>>;
    public readonly additionalProperties?: GbnfTerminal;
    public readonly minProperties: number;
    public readonly maxProperties?: number;
    public readonly scopeState: GbnfJsonScopeState;

    public constructor({
        fields, additionalProperties, minProperties = 0, maxProperties,
        scopeState = new GbnfJsonScopeState()
    }: {
        fields: Array<Readonly<{key: GbnfString | GbnfStringValue, value: GbnfTerminal, required: true}>>,
        additionalProperties?: GbnfTerminal,
        minProperties?: number, maxProperties?: number,
        scopeState?: GbnfJsonScopeState
    }) {
        super();

        this.fields = fields;
        this.additionalProperties = additionalProperties;
        this.minProperties = Math.floor(minProperties);
        this.maxProperties = maxProperties == null ? undefined : Math.floor(maxProperties);
        this.scopeState = scopeState;

        if (this.minProperties < this.fields.length)
            this.minProperties = this.fields.length;

        if (this.maxProperties != null && this.maxProperties < this.minProperties)
            this.maxProperties = this.minProperties;
        else if (this.maxProperties != null && this.maxProperties < 0)
            this.maxProperties = 0;
    }

    public getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const getWhitespaceRuleName = (newScope: boolean, newLine: "before" | "after" | false) => (
            newScope
                ? new GbnfWhitespace(this.scopeState.getForNewScope(), {newLine}).resolve(grammarGenerator)
                : new GbnfWhitespace(this.scopeState, {newLine}).resolve(grammarGenerator)
        );

        const getCommaWhitespaceRule = (newScope: boolean, newLine: "before" | "after" | false) => (
            newScope
                ? new GbnfCommaWhitespace(this.scopeState.getForNewScope(), {newLine})
                : new GbnfCommaWhitespace(this.scopeState, {newLine})
        );
        const getCommaWhitespaceRuleName = (newScope: boolean, newLine: "before" | "after" | false) => (
            getCommaWhitespaceRule(newScope, newLine).resolve(grammarGenerator)
        );

        const objectItemsGrammar: string[] = [];
        for (const {key, value} of this.fields) {
            if (objectItemsGrammar.length > 0)
                objectItemsGrammar.push(getCommaWhitespaceRuleName(true, "before"));

            objectItemsGrammar.push(
                new GbnfGrammar([
                    key.getGrammar(grammarGenerator), '":"', "[ ]?", value.resolve(grammarGenerator)
                ]).getGrammar()
            );
        }

        if (this.additionalProperties != null) {
            const additionalPropertiesGrammar = new GbnfGrammar([
                new GbnfString().resolve(grammarGenerator), '":"', "[ ]?", this.additionalProperties.resolve(grammarGenerator)
            ]);

            if (this.minProperties > this.fields.length) {
                if (objectItemsGrammar.length > 0)
                    objectItemsGrammar.push(getCommaWhitespaceRuleName(true, "before"));

                objectItemsGrammar.push(
                    new GbnfRepetition({
                        value: additionalPropertiesGrammar,
                        separator: getCommaWhitespaceRule(true, "before"),
                        minRepetitions: this.minProperties - this.fields.length,
                        maxRepetitions: this.maxProperties == null
                            ? undefined
                            : this.maxProperties - this.fields.length
                    }).getGrammar(grammarGenerator)
                );
            } else if (this.maxProperties == null || this.maxProperties > this.fields.length) {
                if (objectItemsGrammar.length === 0)
                    objectItemsGrammar.push(
                        new GbnfRepetition({
                            value: additionalPropertiesGrammar,
                            separator: getCommaWhitespaceRule(true, "before"),
                            maxRepetitions: this.maxProperties == null
                                ? undefined
                                : this.maxProperties - this.fields.length
                        }).getGrammar(grammarGenerator)
                    );
                else
                    objectItemsGrammar.push(
                        new GbnfRepetition({
                            value: new GbnfGrammar([
                                getCommaWhitespaceRuleName(true, "before"),
                                additionalPropertiesGrammar.resolve(grammarGenerator)
                            ], true),
                            maxRepetitions: this.maxProperties == null
                                ? undefined
                                : this.maxProperties - this.fields.length
                        }).getGrammar(grammarGenerator)
                    );
            }
        }

        return new GbnfGrammar([
            '"{"', getWhitespaceRuleName(true, "before"),
            new GbnfGrammar(objectItemsGrammar).getGrammar(),
            getWhitespaceRuleName(false, "before"), '"}"'
        ]).getGrammar();
    }
}
