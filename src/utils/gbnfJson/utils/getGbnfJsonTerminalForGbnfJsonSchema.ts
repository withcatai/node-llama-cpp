import {GbnfOr} from "../terminals/GbnfOr.js";
import {GbnfObjectMap} from "../terminals/GbnfObjectMap.js";
import {GbnfStringValue} from "../terminals/GbnfStringValue.js";
import {GbnfArray} from "../terminals/GbnfArray.js";
import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfString} from "../terminals/GbnfString.js";
import {GbnfNumber} from "../terminals/GbnfNumber.js";
import {GbnfBoolean} from "../terminals/GbnfBoolean.js";
import {GbnfNull} from "../terminals/GbnfNull.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {
    GbnfJsonSchema, isGbnfJsonArraySchema, isGbnfJsonBasicSchemaIncludesType, isGbnfJsonConstSchema, isGbnfJsonEnumSchema,
    isGbnfJsonObjectSchema, isGbnfJsonOneOfSchema
} from "../types.js";
import {getConsoleLogPrefix} from "../../getConsoleLogPrefix.js";
import {getGbnfJsonTerminalForLiteral} from "./getGbnfJsonTerminalForLiteral.js";
import {GbnfJsonScopeState} from "./GbnfJsonScopeState.js";


export function getGbnfJsonTerminalForGbnfJsonSchema(
    schema: GbnfJsonSchema, grammarGenerator: GbnfGrammarGenerator, scopeState: GbnfJsonScopeState = new GbnfJsonScopeState()
): GbnfTerminal {
    if (isGbnfJsonOneOfSchema(schema)) {
        const values = schema.oneOf
            .map((altSchema) => getGbnfJsonTerminalForGbnfJsonSchema(altSchema, grammarGenerator, scopeState));

        return new GbnfOr(values);
    } else if (isGbnfJsonConstSchema(schema)) {
        return getGbnfJsonTerminalForLiteral(schema.const);
    } else if (isGbnfJsonEnumSchema(schema)) {
        return new GbnfOr(schema.enum.map((item) => getGbnfJsonTerminalForLiteral(item)));
    } else if (isGbnfJsonObjectSchema(schema)) {
        return new GbnfObjectMap(
            Object.entries(schema.properties).map(([propName, propSchema]) => {
                return {
                    required: true,
                    key: new GbnfStringValue(propName),
                    value: getGbnfJsonTerminalForGbnfJsonSchema(propSchema, grammarGenerator, scopeState.getForNewScope())
                };
            }),
            scopeState
        );
    } else if (isGbnfJsonArraySchema(schema)) {
        let maxItems = schema.maxItems;
        if (schema.prefixItems != null && maxItems != null && maxItems < schema.prefixItems.length) {
            console.warn(
                getConsoleLogPrefix(true, false),
                `maxItems (${maxItems}) must be greater than or equal to prefixItems array length (${schema.prefixItems.length}). ` +
                "Using prefixItems length as maxItems."
            );
            maxItems = schema.prefixItems.length;
        }

        return new GbnfArray({
            items: schema.items == null
                ? undefined
                : getGbnfJsonTerminalForGbnfJsonSchema(schema.items, grammarGenerator, scopeState),
            prefixItems: schema.prefixItems == null
                ? undefined
                : schema.prefixItems.map((item) => getGbnfJsonTerminalForGbnfJsonSchema(item, grammarGenerator, scopeState)),
            minItems: schema.minItems,
            maxItems,
            scopeState
        });
    }

    const terminals: GbnfTerminal[] = [];

    if (isGbnfJsonBasicSchemaIncludesType(schema, "string"))
        terminals.push(new GbnfString());

    if (isGbnfJsonBasicSchemaIncludesType(schema, "number"))
        terminals.push(new GbnfNumber({allowFractional: true}));

    if (isGbnfJsonBasicSchemaIncludesType(schema, "integer"))
        terminals.push(new GbnfNumber({allowFractional: false}));

    if (isGbnfJsonBasicSchemaIncludesType(schema, "boolean"))
        terminals.push(new GbnfBoolean());

    if (isGbnfJsonBasicSchemaIncludesType(schema, "null"))
        terminals.push(new GbnfNull());

    return new GbnfOr(terminals);
}
