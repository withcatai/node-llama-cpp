export type GbnfJsonSchemaImmutableType = "string" | "number" | "integer" | "boolean" | "null";
export type GbnfJsonSchema = GbnfJsonBasicSchema | GbnfJsonConstSchema | GbnfJsonEnumSchema | GbnfJsonOneOfSchema | GbnfJsonObjectSchema |
    GbnfJsonArraySchema;

export type GbnfJsonBasicSchema = {
    type: GbnfJsonSchemaImmutableType | readonly GbnfJsonSchemaImmutableType[]
};
export type GbnfJsonConstSchema = {
    const: string | number | boolean | null
};
export type GbnfJsonEnumSchema = {
    enum: readonly (string | number | boolean | null)[]
};
export type GbnfJsonOneOfSchema = {
    oneOf: readonly GbnfJsonSchema[]
};
export type GbnfJsonObjectSchema<Keys extends string = string> = {
    type: "object",
    properties: Readonly<{ [key in Keys]: GbnfJsonSchema }>,
    required?: readonly Keys[]
};
export type GbnfJsonArraySchema = {
    type: "array",
    items: GbnfJsonSchema
};


/**
 * Converts a GBNF JSON schema to a TypeScript type
 */
export type GbnfJsonSchemaToType<T> = GbnfJsonSchemaToTSType<T>;

export type GbnfJsonSchemaToTSType<T> =
    GbnfJsonBasicSchema extends T
        ? undefined
        : undefined extends T
            ? undefined
            : T extends GbnfJsonBasicSchema
                ? GbnfJsonBasicSchemaToType<T["type"]>
                : T extends GbnfJsonConstSchema
                    ? T["const"]
                    : T extends GbnfJsonEnumSchema
                        ? T["enum"][number]
                        : T extends GbnfJsonOneOfSchema
                            ? GbnfJsonSchemaToType<T["oneOf"][number]>
                            : T extends GbnfJsonObjectSchema
                                ? GbnfJsonObjectSchemaToType<T["properties"]>
                                : T extends GbnfJsonArraySchema
                                    ? GbnfJsonSchemaToType<T["items"]>[]
                                    : undefined;

type GbnfJsonBasicSchemaToType<T> =
    T extends GbnfJsonSchemaImmutableType
        ? ImmutableTypeToType<T>
        : T extends GbnfJsonSchemaImmutableType[]
            ? ImmutableTypeToType<T[number]>
            : never;

type ImmutableTypeToType<T> =
    T extends "string"
        ? string
        : T extends "number"
            ? number
            : T extends "integer"
                ? number
                : T extends "boolean"
                    ? boolean
                    : T extends "null"
                        ? null
                        : never;

type GbnfJsonObjectSchemaToType<Props> = {
    [P in keyof Props]: GbnfJsonSchemaToType<Props[P]>
};


export function isGbnfJsonConstSchema(schema: GbnfJsonSchema): schema is GbnfJsonConstSchema {
    return (schema as GbnfJsonConstSchema).const !== undefined;
}

export function isGbnfJsonEnumSchema(schema: GbnfJsonSchema): schema is GbnfJsonEnumSchema {
    return (schema as GbnfJsonEnumSchema).enum != null;
}

export function isGbnfJsonOneOfSchema(schema: GbnfJsonSchema): schema is GbnfJsonOneOfSchema {
    return (schema as GbnfJsonOneOfSchema).oneOf != null;
}

export function isGbnfJsonObjectSchema(schema: GbnfJsonSchema): schema is GbnfJsonObjectSchema {
    return (schema as GbnfJsonObjectSchema).type === "object";
}

export function isGbnfJsonArraySchema(schema: GbnfJsonSchema): schema is GbnfJsonArraySchema {
    return (schema as GbnfJsonArraySchema).type === "array";
}

export function isGbnfJsonBasicSchemaIncludesType<T extends GbnfJsonSchemaImmutableType>(
    schema: GbnfJsonBasicSchema, type: T
): schema is GbnfJsonBasicSchema & {type: T | (T | GbnfJsonSchemaImmutableType)[]} {
    if (schema.type instanceof Array)
        return schema.type.includes(type);

    return schema.type === type;
}
