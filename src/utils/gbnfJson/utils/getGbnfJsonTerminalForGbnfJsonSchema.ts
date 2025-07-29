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
    isGbnfJsonObjectSchema, isGbnfJsonOneOfSchema, isGbnfJsonBasicStringSchema, isGbnfJsonFormatStringSchema, isGbnfJsonRefSchema
} from "../types.js";
import {getConsoleLogPrefix} from "../../getConsoleLogPrefix.js";
import {GbnfAnyJson} from "../terminals/GbnfAnyJson.js";
import {GbnfFormatString} from "../terminals/GbnfFormatString.js";
import {GbnfRef} from "../terminals/GbnfRef.js";
import {getGbnfJsonTerminalForLiteral} from "./getGbnfJsonTerminalForLiteral.js";
import {GbnfJsonScopeState} from "./GbnfJsonScopeState.js";
import {joinDefs} from "./defsScope.js";

const maxNestingScope = 512;

export function getGbnfJsonTerminalForGbnfJsonSchema(
    schema: GbnfJsonSchema,
    grammarGenerator: GbnfGrammarGenerator,
    scopeState: GbnfJsonScopeState = new GbnfJsonScopeState(),
    defs: Record<string, GbnfJsonSchema> = {}
): GbnfTerminal {
    if (scopeState.currentNestingScope >= maxNestingScope)
        throw new Error("Maximum nesting scope exceeded. Ensure that your schema does not have circular references or excessive nesting.");

    if (isGbnfJsonRefSchema(schema)) {
        const currentDefs = joinDefs(defs, schema.$defs);
        grammarGenerator.registerDefs(currentDefs);

        const ref = schema?.$ref;
        const referencePrefix = "#/$defs/";
        if (ref == null || !ref.startsWith(referencePrefix)) {
            console.warn(
                getConsoleLogPrefix(true, false),
                `Reference "${ref}" does not start with "${referencePrefix}". ` +
                'Using an "any" type instead of a reference.'
            );
            return new GbnfAnyJson(scopeState);
        }

        const defName = ref.slice(referencePrefix.length);
        const def = currentDefs[defName];
        if (def == null) {
            console.warn(
                getConsoleLogPrefix(true, false),
                `Reference "${ref}" does not point to an existing definition. ` +
                'Using an "any" type instead of a reference.'
            );
            return new GbnfAnyJson(scopeState);
        }

        return new GbnfRef({
            getValueTerminal() {
                const scopeDefs = grammarGenerator.defScopeDefs.get([defName, def]);

                return getGbnfJsonTerminalForGbnfJsonSchema(
                    def,
                    grammarGenerator,
                    new GbnfJsonScopeState({
                        allowNewLines: false,
                        scopePadSpaces: scopeState.settings.scopePadSpaces
                    }, 0),
                    scopeDefs ?? {}
                );
            },
            def,
            defName
        });
    } else if (isGbnfJsonOneOfSchema(schema)) {
        const currentDefs = joinDefs(defs, schema.$defs);
        grammarGenerator.registerDefs(currentDefs);

        const values = schema.oneOf
            .map((altSchema) => (
                getGbnfJsonTerminalForGbnfJsonSchema(
                    altSchema,
                    grammarGenerator,
                    scopeState,
                    currentDefs
                )
            ));

        return new GbnfOr(values);
    } else if (isGbnfJsonConstSchema(schema)) {
        return getGbnfJsonTerminalForLiteral(schema.const);
    } else if (isGbnfJsonEnumSchema(schema)) {
        return new GbnfOr(schema.enum.map((item) => getGbnfJsonTerminalForLiteral(item)));
    } else if (isGbnfJsonObjectSchema(schema)) {
        const propertiesEntries = Object.entries(schema.properties ?? {});
        const currentDefs = joinDefs(defs, schema.$defs);
        grammarGenerator.registerDefs(currentDefs);

        let maxProperties = schema.maxProperties;
        if (schema.properties != null && maxProperties != null && maxProperties < propertiesEntries.length) {
            console.warn(
                getConsoleLogPrefix(true, false),
                `maxProperties (${maxProperties}) must be greater than or equal to ` +
                `properties object keys number (${propertiesEntries.length}). ` +
                "Using properties object keys number as maxProperties."
            );
            maxProperties = propertiesEntries.length;
        }

        return new GbnfObjectMap({
            fields: propertiesEntries.map(([propName, propSchema]) => {
                return {
                    required: true,
                    key: new GbnfStringValue(propName),
                    value: getGbnfJsonTerminalForGbnfJsonSchema(
                        propSchema,
                        grammarGenerator,
                        scopeState.getForNewScope(),
                        currentDefs
                    )
                };
            }),
            additionalProperties: (schema.additionalProperties == null || schema.additionalProperties === false)
                ? undefined
                : schema.additionalProperties === true
                    ? new GbnfAnyJson(scopeState.getForNewScope())
                    : getGbnfJsonTerminalForGbnfJsonSchema(
                        schema.additionalProperties,
                        grammarGenerator,
                        scopeState.getForNewScope(),
                        currentDefs
                    ),
            minProperties: schema.minProperties,
            maxProperties,
            scopeState
        });
    } else if (isGbnfJsonArraySchema(schema)) {
        const currentDefs = joinDefs(defs, schema.$defs);
        grammarGenerator.registerDefs(currentDefs);

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
                : getGbnfJsonTerminalForGbnfJsonSchema(schema.items, grammarGenerator, scopeState.getForNewScope(), currentDefs),
            prefixItems: schema.prefixItems == null
                ? undefined
                : schema.prefixItems.map((item) => (
                    getGbnfJsonTerminalForGbnfJsonSchema(item, grammarGenerator, scopeState.getForNewScope(), currentDefs)
                )),
            minItems: schema.minItems,
            maxItems,
            scopeState
        });
    } else if (isGbnfJsonBasicStringSchema(schema)) {
        const minLength = Math.max(0, schema.minLength ?? 0);
        let maxLength = schema.maxLength;
        if (maxLength != null && maxLength < minLength) {
            console.warn(
                getConsoleLogPrefix(true, false),
                `maxLength (${maxLength}) must be greater than or equal to minLength (${minLength}). ` +
                "Using minLength as maxLength."
            );
            maxLength = minLength;
        }

        return new GbnfString({
            minLength,
            maxLength
        });
    } else if (isGbnfJsonFormatStringSchema(schema))
        return new GbnfFormatString(schema.format);

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

    if (terminals.length === 0)
        terminals.push(new GbnfNull());

    return new GbnfOr(terminals);
}
