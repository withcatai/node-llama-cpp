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
        return new GbnfArray(getGbnfJsonTerminalForGbnfJsonSchema(schema.items, grammarGenerator, scopeState), scopeState);
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
