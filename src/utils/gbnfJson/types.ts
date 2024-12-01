export type GbnfJsonSchemaImmutableType = "string" | "number" | "integer" | "boolean" | "null";
export type GbnfJsonSchema = GbnfJsonBasicSchema | GbnfJsonConstSchema | GbnfJsonEnumSchema | GbnfJsonOneOfSchema |
    GbnfJsonStringSchema | GbnfJsonObjectSchema | GbnfJsonArraySchema;

export type GbnfJsonBasicSchema = {
    readonly type: GbnfJsonSchemaImmutableType | readonly GbnfJsonSchemaImmutableType[],

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};
export type GbnfJsonConstSchema = {
    readonly const: string | number | boolean | null,

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};
export type GbnfJsonEnumSchema = {
    readonly enum: readonly (string | number | boolean | null)[],

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};
export type GbnfJsonOneOfSchema = {
    readonly oneOf: readonly GbnfJsonSchema[],

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};
export type GbnfJsonStringSchema = GbnfJsonBasicStringSchema | GbnfJsonFormatStringSchema;
export type GbnfJsonBasicStringSchema = {
    readonly type: "string",

    /**
     * When using `minLength` and/or `maxLength`,
     * ensure to inform the model as part of the prompt what your expectations are regarding the length of the string.
     * Not doing this may lead to hallucinations.
     */
    readonly minLength?: number,

    /**
     * When using `minLength` and/or `maxLength`,
     * ensure to inform the model as part of the prompt what your expectations are regarding the length of the string.
     * Not doing this may lead to hallucinations.
     */
    readonly maxLength?: number,

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};
export type GbnfJsonFormatStringSchema = {
    readonly type: "string",
    readonly format: "date-time" | "time" | "date",

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};
export type GbnfJsonObjectSchema<Keys extends string = string> = {
    readonly type: "object",
    readonly properties?: {readonly [key in Keys]: GbnfJsonSchema},

    /**
     * Unlike the JSON Schema spec, `additionalProperties` defaults to `false` to avoid breaking existing code.
     */
    readonly additionalProperties?: boolean | GbnfJsonSchema,

    /**
     * Make sure you define `additionalProperties` for this to have any effect.
     *
     * When using `minProperties` and/or `maxProperties`,
     * ensure to inform the model as part of the prompt what your expectations are regarding the number of keys in the object.
     * Not doing this may lead to hallucinations.
     */
    readonly minProperties?: number,

    /**
     * Make sure you define `additionalProperties` for this to have any effect.
     *
     * When using `minProperties` and/or `maxProperties`,
     * ensure to inform the model as part of the prompt what your expectations are regarding the number of keys in the object.
     * Not doing this may lead to hallucinations.
     */
    readonly maxProperties?: number,

    /**
     * `required` is always set to all keys in `properties`, and setting it has no effect.
     *
     * This limitation is due to how the generation works, and may be fixed in the future.
     *
     * This key is part of the type to avoid breaking exiting code (though it was never actually used in the past),
     * and will be removed in the future.
     * @deprecated
     */
    readonly required?: readonly Keys[],

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};
export type GbnfJsonArraySchema = {
    readonly type: "array",
    readonly items?: GbnfJsonSchema,
    readonly prefixItems?: readonly GbnfJsonSchema[],

    /**
     * When using `minItems` and/or `maxItems`,
     * ensure to inform the model as part of the prompt what your expectations are regarding the length of the array.
     * Not doing this may lead to hallucinations.
     */
    readonly minItems?: number,

    /**
     * When using `minItems` and/or `maxItems`,
     * ensure to inform the model as part of the prompt what your expectations are regarding the length of the array.
     * Not doing this may lead to hallucinations.
     */
    readonly maxItems?: number,

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string
};


/**
 * Converts a GBNF JSON schema to a TypeScript type
 */
export type GbnfJsonSchemaToType<T> = GbnfJsonSchemaToTSType<T>;

export type GbnfJsonSchemaToTSType<T> =
    Readonly<GbnfJsonBasicSchema> extends T
        ? undefined
        : undefined extends T
            ? undefined
        : T extends GbnfJsonBasicStringSchema
            ? GbnfJsonBasicStringSchemaToType<T>
            : T extends GbnfJsonFormatStringSchema
                ? string
                : T extends GbnfJsonBasicSchema
                    ? GbnfJsonBasicSchemaToType<T["type"]>
                    : T extends GbnfJsonConstSchema
                        ? T["const"]
                        : T extends GbnfJsonEnumSchema
                            ? T["enum"][number]
                            : T extends GbnfJsonOneOfSchema
                                ? GbnfJsonSchemaToType<T["oneOf"][number]>
                                : T extends GbnfJsonObjectSchema
                                    ? GbnfJsonObjectSchemaToType<T>
                                    : T extends GbnfJsonArraySchema
                                        ? ArrayTypeToType<T>
                                        : undefined;

type GbnfJsonBasicStringSchemaToType<T extends GbnfJsonBasicStringSchema> =
    T["maxLength"] extends 0
        ? ""
        : string;

type GbnfJsonBasicSchemaToType<T extends GbnfJsonBasicSchema["type"]> =
    T extends GbnfJsonSchemaImmutableType
        ? ImmutableTypeToType<T>
        : T extends GbnfJsonSchemaImmutableType[]
            ? ImmutableTypeToType<T[number]>
            : never;

type ImmutableTypeToType<T extends GbnfJsonSchemaImmutableType> =
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
        ? T["prefixItems"] extends readonly GbnfJsonSchema[]
            ? keyof T["prefixItems"] extends T["minItems"]
                ? T["prefixItems"]["length"]
                : T["minItems"]
            : T["minItems"]
        : T["prefixItems"] extends readonly GbnfJsonSchema[]
            ? T["prefixItems"]["length"]
            : 0
> =
    T["prefixItems"] extends readonly GbnfJsonSchema[]
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
    T extends GbnfJsonObjectSchema,
    Props extends Readonly<Record<string, GbnfJsonSchema>> | undefined = T["properties"],
    AdditionalProps extends true | false | GbnfJsonSchema | undefined = T["additionalProperties"],
    PropsMap = Props extends undefined
        ? {}
        : {-readonly [P in keyof Props]: GbnfJsonSchemaToType<Props[P]>},
    Res = AdditionalProps extends undefined | false
        ? PropsMap
        : AdditionalProps extends true
            ? PropsMap & {[key: string]: GbnfJsonAnyValue}
            : AdditionalProps extends GbnfJsonSchema
                ? PropsMap & {[key: string]: GbnfJsonSchemaToType<AdditionalProps>}
                : PropsMap
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

export function isGbnfJsonBasicStringSchema(schema: GbnfJsonSchema): schema is GbnfJsonBasicStringSchema {
    return (schema as GbnfJsonBasicStringSchema).type === "string" && (schema as GbnfJsonFormatStringSchema).format == null;
}

export function isGbnfJsonFormatStringSchema(schema: GbnfJsonSchema): schema is GbnfJsonFormatStringSchema {
    return (schema as GbnfJsonFormatStringSchema).type === "string" && (schema as GbnfJsonFormatStringSchema).format != null;
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
