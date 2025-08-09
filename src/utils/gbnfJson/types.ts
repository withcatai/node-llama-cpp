export type GbnfJsonSchemaImmutableType = "string" | "number" | "integer" | "boolean" | "null";

export type GbnfJsonSchema<Defs extends GbnfJsonDefList<Defs> = Record<any, any>> = GbnfJsonBasicSchema | GbnfJsonConstSchema |
    GbnfJsonEnumSchema | GbnfJsonOneOfSchema<Defs> | GbnfJsonStringSchema | GbnfJsonObjectSchema<string, Defs> |
    GbnfJsonArraySchema<Defs> | (
        keyof Defs extends string
            ? keyof NoInfer<Defs> extends never
                ? never
                : GbnfJsonRefSchema<Defs>
            : never
    );

export type GbnfJsonDefList<Defs extends GbnfJsonDefList<NoInfer<Defs>> = {}> = {
    readonly [key: string]: GbnfJsonSchema<NoInfer<Defs>>
};

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
export type GbnfJsonOneOfSchema<Defs extends GbnfJsonDefList<NoInfer<Defs>> = {}> = {
    readonly oneOf: readonly GbnfJsonSchema<NoInfer<Defs>>[],

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string,

    readonly $defs?: Defs
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
export type GbnfJsonObjectSchema<
    Keys extends string = string,
    Defs extends GbnfJsonDefList<NoInfer<Defs>> = {}
> = {
    readonly type: "object",
    readonly properties?: {readonly [key in Keys]: GbnfJsonSchema<NoInfer<Defs>>},

    /**
     * Unlike the JSON Schema spec, `additionalProperties` defaults to `false` to avoid breaking existing code.
     */
    readonly additionalProperties?: boolean | GbnfJsonSchema<NoInfer<Defs>>,

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
    readonly description?: string,

    readonly $defs?: Defs
};
export type GbnfJsonArraySchema<Defs extends GbnfJsonDefList<NoInfer<Defs>> = {}> = {
    readonly type: "array",
    readonly items?: GbnfJsonSchema<NoInfer<Defs>>,
    readonly prefixItems?: readonly GbnfJsonSchema<NoInfer<Defs>>[],

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
    readonly description?: string,

    readonly $defs?: Defs
};
export type GbnfJsonRefSchema<Defs extends GbnfJsonDefList<NoInfer<Defs>> = {}> = {
    readonly $ref: keyof NoInfer<Defs> extends never
        ? never
        : `#/$defs/${OnlyStringKeys<NoInfer<Defs>>}`,

    /**
     * A description of what you expect the model to set this value to.
     *
     * Only passed to the model when using function calling, and has no effect when using JSON Schema grammar directly.
     */
    readonly description?: string,

    readonly $defs?: Defs
};


/**
 * Converts a GBNF JSON schema to a TypeScript type
 */
export type GbnfJsonSchemaToType<T> = 0 extends 1 & T // if T is `any`, return `any`
    ? any
    : GbnfJsonSchemaToTSType<T>;

export type GbnfJsonSchemaToTSType<T, Defs extends GbnfJsonDefList<NoInfer<Defs>> = {}> =
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
                            : T extends GbnfJsonOneOfSchema<Record<any, any>>
                                ? GbnfJsonSchemaToTSType<T["oneOf"][number], CombineDefs<NoInfer<Defs>, T["$defs"]>>
                                : T extends GbnfJsonObjectSchema<string, Record<any, any>>
                                    ? GbnfJsonObjectSchemaToType<T, NoInfer<Defs>>
                                    : T extends GbnfJsonArraySchema<Record<any, any>>
                                        ? ArrayTypeToType<T, CombineDefs<NoInfer<Defs>, T["$defs"]>>
                                        : T extends GbnfJsonRefSchema<any>
                                            ? GbnfJsonRefSchemaToType<T, CombineDefs<NoInfer<Defs>, T["$defs"]>>
                                            : undefined;

type GbnfJsonBasicStringSchemaToType<T extends GbnfJsonBasicStringSchema> =
    T["maxLength"] extends 0
        ? ""
        : string;

type GbnfJsonBasicSchemaToType<T extends GbnfJsonBasicSchema["type"]> =
    T extends GbnfJsonSchemaImmutableType
        ? ImmutableTypeToType<T>
        : T[number] extends GbnfJsonSchemaImmutableType
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
    T extends GbnfJsonArraySchema<Record<any, any>>,
    Defs extends GbnfJsonDefList<Defs> = {},
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
                            ...GbnfJsonOrderedArrayTypes<T["prefixItems"], CombineDefs<Defs, T["$defs"]>>,
                            ...IndexRangeWithSkip<
                                MinItems,
                                T["prefixItems"]["length"],
                                T["items"] extends GbnfJsonSchema
                                    ? GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>
                                    : GbnfJsonAnyValue
                            >
                        ]
                        : [
                            ...GbnfJsonOrderedArrayTypes<T["prefixItems"], CombineDefs<Defs, T["$defs"]>>,
                            ...(
                                T["items"] extends GbnfJsonSchema
                                    ? GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>
                                    : GbnfJsonAnyValue
                            )[]
                        ]
                )
                : T["maxItems"] extends MinItems
                    ? [
                        ...GbnfJsonOrderedArrayTypes<T["prefixItems"], CombineDefs<Defs, T["$defs"]>>,
                        ...(
                            T["items"] extends GbnfJsonSchema
                                ? IndexRangeWithSkip<
                                    T["maxItems"],
                                    T["prefixItems"]["length"],
                                    GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>
                                >
                                : IndexRangeWithSkip<T["maxItems"], T["prefixItems"]["length"], GbnfJsonAnyValue>
                            )
                    ]
                    : [
                        ...GbnfJsonOrderedArrayTypes<T["prefixItems"], CombineDefs<Defs, T["$defs"]>>,
                        ...IndexRangeWithSkip<
                            MinItems,
                            T["prefixItems"]["length"],
                            T["items"] extends GbnfJsonSchema
                                ? GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>
                                : GbnfJsonAnyValue
                        >,
                        ...(
                            T["items"] extends GbnfJsonSchema
                                ? GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>
                                : GbnfJsonAnyValue
                        )[]
                    ]
        )
        : T["items"] extends GbnfJsonSchema
            ? (
                MinItems extends 0
                    ? GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>[]
                    : T["maxItems"] extends MinItems
                        ? IndexRange<
                            T["maxItems"],
                            GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>
                        >
                        : [
                            ...IndexRange<
                                MinItems,
                                GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>
                            >,
                            ...GbnfJsonSchemaToTSType<T["items"], CombineDefs<Defs, T["$defs"]>>[]
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
    T extends GbnfJsonObjectSchema<string, Record<any, any>>,
    Defs extends GbnfJsonDefList<Defs> = {},
    Props extends Readonly<Record<string, GbnfJsonSchema>> | undefined = T["properties"],
    AdditionalProps extends true | false | GbnfJsonSchema | undefined = T["additionalProperties"],
    PropsMap = Props extends undefined
        ? {}
        : {-readonly [P in keyof Props]: GbnfJsonSchemaToTSType<Props[P], CombineDefs<Defs, T["$defs"]>>},
    Res = AdditionalProps extends undefined | false
        ? PropsMap
        : AdditionalProps extends true
            ? PropsMap & {[key: string]: GbnfJsonAnyValue}
            : AdditionalProps extends GbnfJsonSchema
                ? PropsMap & {
                    [key: string]: GbnfJsonSchemaToTSType<AdditionalProps, CombineDefs<Defs, T["$defs"]>>
                }
                : PropsMap
> = Res;

type GbnfJsonRefSchemaToType<T extends GbnfJsonRefSchema<Defs>, Defs extends GbnfJsonDefList<Defs> = {}> =
    T["$ref"] extends `#/$defs/${infer Key}`
        ? Key extends keyof Defs
            ? GbnfJsonSchemaToTSType<Defs[Key], Defs>
            : never
        : never;

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

export function isGbnfJsonRefSchema(schema: GbnfJsonSchema): schema is GbnfJsonRefSchema<Record<any, any>> {
    return typeof (schema as GbnfJsonRefSchema).$ref === "string";
}

export function isGbnfJsonBasicSchemaIncludesType<T extends GbnfJsonSchemaImmutableType>(
    schema: GbnfJsonBasicSchema, type: T
): schema is GbnfJsonBasicSchema & {type: T | (T | GbnfJsonSchemaImmutableType)[]} {
    if (schema.type instanceof Array)
        return schema.type.includes(type);

    return schema.type === type;
}

type OnlyStringKeys<T extends object> = {
    [K in keyof T]: K extends string ? K : never;
}[keyof T];

type CombineDefs<
    Defs1 extends GbnfJsonDefList<Defs1>,
    Param2 extends Defs1 | Defs2 | undefined,
    Defs2 extends GbnfJsonDefList<Defs2> = {}
> =
    undefined extends NoInfer<Param2>
        ? Defs1
        : Defs1 & Param2;

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

type GbnfJsonOrderedArrayTypes<T extends readonly GbnfJsonSchema[], Defs extends GbnfJsonDefList<Defs> = {}> = {
    -readonly [P in keyof T]: GbnfJsonSchemaToTSType<T[P], Defs>
};
