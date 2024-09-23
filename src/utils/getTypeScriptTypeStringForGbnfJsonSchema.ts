import {
    GbnfJsonSchema, isGbnfJsonArraySchema, isGbnfJsonBasicSchemaIncludesType, isGbnfJsonConstSchema,
    isGbnfJsonEnumSchema, isGbnfJsonObjectSchema, isGbnfJsonOneOfSchema
} from "./gbnfJson/types.js";

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
        return [
            "{",
            Object.entries(schema.properties)
                .map(([propName, propSchema]) => {
                    const escapedValue = JSON.stringify(propName) ?? "";
                    const keyText = escapedValue.slice(1, -1) === propName ? propName : escapedValue;
                    const valueType = getTypeScriptTypeStringForGbnfJsonSchema(propSchema);

                    if (keyText === "" || valueType === "")
                        return "";

                    return keyText + ": " + valueType;
                })
                .filter((item) => item !== "")
                .join(", "),
            "}"
        ].join("");
    } else if (isGbnfJsonArraySchema(schema)) {
        const valuesType = getTypeScriptTypeStringForGbnfJsonSchema(schema.items);

        if (valuesType === "")
            return "[]";

        return "(" + valuesType + ")[]";
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
