import {
    GbnfJsonSchema, isGbnfJsonArraySchema, isGbnfJsonBasicSchemaIncludesType, isGbnfJsonBasicStringSchema, isGbnfJsonConstSchema,
    isGbnfJsonEnumSchema, isGbnfJsonFormatStringSchema, isGbnfJsonObjectSchema, isGbnfJsonOneOfSchema
} from "./gbnfJson/types.js";

const maxTypeRepetition = 10;

export function getTypeScriptTypeStringForGbnfJsonSchema(schema: GbnfJsonSchema): string {
    if (isGbnfJsonOneOfSchema(schema)) {
        const values = schema.oneOf
            .map((altSchema) => getTypeScriptTypeStringForGbnfJsonSchema(altSchema));

        return values.join(" | ");
    } else if (isGbnfJsonConstSchema(schema)) {
        return JSON.stringify(schema.const) ?? "";
    } else if (isGbnfJsonEnumSchema(schema)) {
        return schema.enum
            .map((item) => JSON.stringify(item) ?? "")
            .filter((item) => item !== "")
            .join(" | ");
    } else if (isGbnfJsonObjectSchema(schema)) {
        let addNewline = false;
        const valueTypes = Object.entries(schema.properties ?? {})
            .map(([propName, propSchema]) => {
                const escapedValue = JSON.stringify(propName) ?? "";
                const keyText = escapedValue.slice(1, -1) === propName ? propName : escapedValue;
                const valueType = getTypeScriptTypeStringForGbnfJsonSchema(propSchema);

                if (keyText === "" || valueType === "")
                    return "";

                const mapping = keyText + ": " + valueType;

                const description: string[] = (propSchema.description != null && propSchema.description !== "")
                    ? [propSchema.description]
                    : [];
                const propInfo: string[] = [];

                if (isGbnfJsonBasicStringSchema(propSchema)) {
                    if (propSchema.minLength != null && propSchema.minLength > 0)
                        propInfo.push("minimum length: " + String(Math.floor(propSchema.minLength)));

                    if (propSchema.maxLength != null)
                        propInfo.push("maximum length: " + String(Math.floor(Math.max(propSchema.maxLength, propSchema.minLength ?? 0, 0))));
                } else if (isGbnfJsonFormatStringSchema(propSchema)) {
                    if (propSchema.format === "date-time")
                        propInfo.push("format: ISO 8601 date-time");
                    else
                        propInfo.push("format: " + String(propSchema.format));
                } else if (isGbnfJsonArraySchema(propSchema)) {
                    if (propSchema.minItems != null && propSchema.minItems > maxTypeRepetition)
                        propInfo.push("minimum items: " + String(Math.floor(propSchema.minItems)));

                    if (propSchema.maxItems != null)
                        propInfo.push("maximum items: " + String(Math.floor(Math.max(propSchema.maxItems, propSchema.minItems ?? 0, 0))));
                } else if (isGbnfJsonObjectSchema(propSchema)) {
                    if (propSchema.minProperties != null && propSchema.minProperties > 0)
                        propInfo.push("minimum number of properties: " + String(Math.floor(propSchema.minProperties)));

                    if (propSchema.maxProperties != null)
                        propInfo.push(
                            "maximum number of properties: " +
                            String(Math.floor(Math.max(propSchema.maxProperties, propSchema.minProperties ?? 0, 0)))
                        );
                }

                if (propInfo.length > 0)
                    description.push(propInfo.join(", "));

                if (description.length > 0) {
                    addNewline = true;
                    return [
                        "\n",
                        "// ", description
                            .join("\n")
                            .split("\n")
                            .join("\n// "),
                        "\n",
                        mapping
                    ].join("");
                }

                return mapping;
            })
            .filter((item) => item !== "");

        const knownPropertiesMapSyntax = [
            "{",
            (addNewline && valueTypes.length > 0)
                ? [
                    "\n    ",
                    valueTypes
                        .map((value) => value.split("\n").join("\n    "))
                        .join(",\n    ")
                        .trimStart(),
                    "\n"
                ].join("")
                : valueTypes.join(", "),
            "}"
        ].join("");
        const additionalPropertiesMapSyntax = (schema.additionalProperties == null || schema.additionalProperties == false)
            ? undefined
            : schema.additionalProperties === true
                ? "{[key: string]: any}"
                : schema.additionalProperties != null
                    ? ["{[key: string]: ", getTypeScriptTypeStringForGbnfJsonSchema(schema.additionalProperties), "}"].join("")
                    : undefined;

        if (valueTypes.length === 0 && additionalPropertiesMapSyntax != null)
            return additionalPropertiesMapSyntax;
        else if (additionalPropertiesMapSyntax != null)
            return [knownPropertiesMapSyntax, " & ", additionalPropertiesMapSyntax].join("");

        return knownPropertiesMapSyntax;
    } else if (isGbnfJsonArraySchema(schema)) {
        if (schema.maxItems === 0)
            return "[]";

        if (schema.prefixItems != null && schema.prefixItems.length > 0) {
            const valueTypes = schema.prefixItems.map((item) => getTypeScriptTypeStringForGbnfJsonSchema(item));

            const restType = schema.items != null
                ? getTypeScriptTypeStringForGbnfJsonSchema(schema.items)
                : "any";

            if (schema.minItems != null) {
                for (let i = schema.prefixItems.length; i < Math.min(schema.prefixItems.length + maxTypeRepetition, schema.minItems); i++)
                    valueTypes.push(restType);
            }

            if (schema.maxItems == null || schema.maxItems > valueTypes.length)
                valueTypes.push("..." + wrapWithParensIfNeeded(restType) + "[]");

            return "[" + valueTypes.join(", ") + "]";
        } else if (schema.items != null) {
            const valuesType = getTypeScriptTypeStringForGbnfJsonSchema(schema.items);

            if (valuesType === "")
                return "[]";

            if (schema.minItems != null) {
                if (schema.minItems === schema.maxItems) {
                    if (schema.minItems < maxTypeRepetition)
                        return "[" + (valuesType + ", ").repeat(schema.minItems).slice(0, -", ".length) + "]";
                    else
                        return [
                            "[",
                            (valuesType + ", ").repeat(maxTypeRepetition),
                            "...", wrapWithParensIfNeeded(valuesType), "[]",
                            "]"
                        ].join("");
                } else if (schema.minItems <= 0)
                    return wrapWithParensIfNeeded(valuesType) + "[]";
                else if (schema.minItems < maxTypeRepetition)
                    return "[" + (valuesType + ", ").repeat(schema.minItems) + "..." + wrapWithParensIfNeeded(valuesType) + "[]]";
                else
                    return wrapWithParensIfNeeded(valuesType) + "[]";
            }

            return wrapWithParensIfNeeded(valuesType) + "[]";
        }

        return "any[]";
    }

    const types: ("string" | "number" | "bigint" | "boolean" | "null")[] = [];

    if (isGbnfJsonBasicSchemaIncludesType(schema, "string"))
        types.push("string");

    if (isGbnfJsonBasicSchemaIncludesType(schema, "number"))
        types.push("number");

    if (isGbnfJsonBasicSchemaIncludesType(schema, "integer"))
        types.push("bigint");

    if (isGbnfJsonBasicSchemaIncludesType(schema, "boolean"))
        types.push("boolean");

    if (isGbnfJsonBasicSchemaIncludesType(schema, "null"))
        types.push("null");

    return types.join(" | ");
}

function wrapWithParensIfNeeded(text: string): string {
    if (text.includes(" ") || text.includes("|") || text.includes("&") || text.includes("\n") || text.includes("\t"))
        return "(" + text + ")";

    return text;
}
