import {
    GbnfJsonSchema, isGbnfJsonArraySchema, isGbnfJsonBasicSchemaIncludesType, isGbnfJsonConstSchema,
    isGbnfJsonEnumSchema, isGbnfJsonObjectSchema, isGbnfJsonOneOfSchema
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
        const valueTypes = Object.entries(schema.properties)
            .map(([propName, propSchema]) => {
                const escapedValue = JSON.stringify(propName) ?? "";
                const keyText = escapedValue.slice(1, -1) === propName ? propName : escapedValue;
                const valueType = getTypeScriptTypeStringForGbnfJsonSchema(propSchema);

                if (keyText === "" || valueType === "")
                    return "";

                const mapping = keyText + ": " + valueType;

                if (propSchema.description != null && propSchema.description !== "") {
                    addNewline = true;
                    return [
                        "\n",
                        "// ", propSchema.description.split("\n").join("\n// "),
                        "\n",
                        mapping
                    ].join("");
                }

                return mapping;
            })
            .filter((item) => item !== "");

        return [
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
