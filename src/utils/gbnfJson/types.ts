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
    properties: Readonly<{[key in Keys]: GbnfJsonSchema}>,
    required?: readonly Keys[]
};
export type GbnfJsonArraySchema = {
    type: "array",
    items?: GbnfJsonSchema,
    prefixItems?: readonly GbnfJsonSchema[],

    /**
     * When using `minItems` and/or `maxItems`,
     * ensure to inform the model as part of the prompt what are your expectation of the length of the array.
     * Not doing this may lead to hallucinations.
     */
    minItems?: number,

    /**
     * When using `minItems` and/or `maxItems`,
     * ensure to inform the model as part of the prompt what are your expectation of the length of the array.
     * Not doing this may lead to hallucinations.
     */
    maxItems?: number
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
                                    ? ArrayTypeToType<T>
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

type ArrayTypeToType<
    T extends GbnfJsonArraySchema,
    MinItems extends number = T["minItems"] extends number
        ? T extends {readonly prefixItems: readonly GbnfJsonSchema[]}
            ? keyof T["prefixItems"] extends T["minItems"]
                ? T["prefixItems"]["length"]
                : T["minItems"]
            : T["minItems"]
        : T extends {readonly prefixItems: readonly GbnfJsonSchema[]}
            ? T["prefixItems"]["length"]
            : 0
> =
    T extends {readonly prefixItems: readonly GbnfJsonSchema[]}
        ? (
            MinItems extends T["prefixItems"]["length"]
                ? (
                    T["maxItems"] extends MinItems
                        ? [
                            ...GbnfJsonOrderedArrayTypes<T["prefixItems"]>,
                            ...IndexRangeWithSkip<
                                MinItems,
                                T["prefixItems"]["length"],
                                T["items"] extends GbnfJsonSchema
                                    ? GbnfJsonSchemaToType<T["items"]>
                                    : GbnfJsonAnyValue
                            >
                        ]
                        : [
                            ...GbnfJsonOrderedArrayTypes<T["prefixItems"]>,
                            ...(
                                T["items"] extends GbnfJsonSchema
                                    ? GbnfJsonSchemaToType<T["items"]>
                                    : GbnfJsonAnyValue
                            )[]
                        ]
                )
                : T["maxItems"] extends MinItems
                    ? [
                        ...GbnfJsonOrderedArrayTypes<T["prefixItems"]>,
                        ...(
                            T["items"] extends GbnfJsonSchema
                                ? IndexRangeWithSkip<T["maxItems"], T["prefixItems"]["length"], GbnfJsonSchemaToType<T["items"]>>
                                : IndexRangeWithSkip<T["maxItems"], T["prefixItems"]["length"], GbnfJsonAnyValue>
                            )
                    ]
                    : [
                        ...GbnfJsonOrderedArrayTypes<T["prefixItems"]>,
                        ...IndexRangeWithSkip<
                            MinItems,
                            T["prefixItems"]["length"],
                            T["items"] extends GbnfJsonSchema
                                ? GbnfJsonSchemaToType<T["items"]>
                                : GbnfJsonAnyValue
                        >,
                        ...(
                            T["items"] extends GbnfJsonSchema
                                ? GbnfJsonSchemaToType<T["items"]>
                                : GbnfJsonAnyValue
                        )[]
                    ]
        )
        : T["items"] extends GbnfJsonSchema
            ? (
                MinItems extends 0
                    ? GbnfJsonSchemaToType<T["items"]>[]
                    : T["maxItems"] extends MinItems
                        ? IndexRange<T["maxItems"], GbnfJsonSchemaToType<T["items"]>>
                        : [
                            ...IndexRange<MinItems, GbnfJsonSchemaToType<T["items"]>>,
                            ...GbnfJsonSchemaToType<T["items"]>[]
                        ]
            )
            : (
                MinItems extends 0
                    ? GbnfJsonAnyValue[]
                    : T["maxItems"] extends MinItems
                        ? IndexRange<T["maxItems"], GbnfJsonAnyValue>
                        : [
                            ...IndexRange<MinItems, GbnfJsonAnyValue>,
                            ...GbnfJsonAnyValue[]
                        ]
            );


type GbnfJsonObjectSchemaToType<
    Props,
    Res = {-readonly [P in keyof Props]: GbnfJsonSchemaToType<Props[P]>}
> = Res;

type GbnfJsonAnyValue = string | number | boolean | null | GbnfJsonAnyValue[] | {[key: string]: GbnfJsonAnyValue};

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

type IndexRange<
    Length extends number,
    FillType = number,
    Res = _IndexRange<[], Length, FillType>
> = Res;
type _IndexRange<
    Value extends FillType[],
    MaxLength extends number,
    FillType = number
> = Value["length"] extends MaxLength
    ? Value
    : _IndexRange<[...Value, FillType], MaxLength, FillType>;

type IndexRangeWithSkip<
    Length extends number,
    SkipFirst extends number,
    FillType,
    Res = _IndexRangeWithSkip<[], IndexRange<SkipFirst>, Length, FillType>
> = Res;
type _IndexRangeWithSkip<
    Value extends FillType[],
    ConditionValue extends number[],
    MaxLength extends number,
    FillType
> = ConditionValue["length"] extends MaxLength
    ? Value
    : _IndexRangeWithSkip<[...Value, FillType], [...ConditionValue, ConditionValue["length"]], MaxLength, FillType>;

type GbnfJsonOrderedArrayTypes<T extends readonly GbnfJsonSchema[]> = {
    -readonly [P in keyof T]: GbnfJsonSchemaToType<T[P]>
};
