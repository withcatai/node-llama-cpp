import {
    GbnfJsonArraySchema, GbnfJsonConstSchema, GbnfJsonEnumSchema, GbnfJsonObjectSchema, GbnfJsonOneOfSchema, GbnfJsonSchema,
    GbnfJsonSchemaImmutableType, GbnfJsonSchemaToType, isGbnfJsonArraySchema, isGbnfJsonConstSchema, isGbnfJsonEnumSchema,
    isGbnfJsonObjectSchema, isGbnfJsonOneOfSchema
} from "../types.js";


export function validateObjectAgainstGbnfSchema(object: any, schema: unknown): boolean;
export function validateObjectAgainstGbnfSchema<T extends GbnfJsonSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T>;
export function validateObjectAgainstGbnfSchema<T extends GbnfJsonSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T> {
    try {
        return validateObjectWithGbnfSchema(object, schema);
    } catch (err) {
        if (err instanceof TechnicalValidationError)
            throw new LlamaJsonSchemaValidationError(err.message, object, schema);

        throw err;
    }
}

export class LlamaJsonSchemaValidationError extends Error {
    public readonly object: any;
    public readonly schema: GbnfJsonSchema;

    public constructor(message: string, object: any, schema: GbnfJsonSchema) {
        super(message);

        this.object = object;
        this.schema = schema;
    }
}

class TechnicalValidationError extends Error {
    public constructor(message: string) {
        super(message);
    }
}

function validateObjectWithGbnfSchema<T extends GbnfJsonSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T> {
    if (isGbnfJsonArraySchema(schema))
        return validateArray(object, schema);
    else if (isGbnfJsonObjectSchema(schema))
        return validateObject(object, schema);
    else if (isGbnfJsonOneOfSchema(schema))
        return validateOneOf(object, schema);
    else if (isGbnfJsonEnumSchema(schema))
        return validateEnum(object, schema);
    else if (isGbnfJsonConstSchema(schema))
        return validateConst(object, schema);

    if (schema.type instanceof Array) {
        for (const type of schema.type) {
            if (validateImmutableType(object, type))
                return true;
        }

        throw new TechnicalValidationError(`Expected one type of [${
            schema.type.map((type) => JSON.stringify(type)).join(", ")
        }] but got type "${object === null ? null : typeof object}"`);
    }

    if (validateImmutableType(object, schema.type))
        return true;

    throw new TechnicalValidationError(`Expected "${schema.type}" but got "${object === null ? "null" : typeof object}"`);
}

function validateArray<T extends GbnfJsonArraySchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T> {
    if (!(object instanceof Array))
        throw new TechnicalValidationError(`Expected an array but got "${typeof object}"`);

    let res = true;
    for (const item of object)
        res &&= validateObjectWithGbnfSchema(item, schema.items);

    return res;
}

function validateObject<T extends GbnfJsonObjectSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T> {
    if (typeof object !== "object" || object === null)
        throw new TechnicalValidationError(`Expected an object but got "${typeof object}"`);

    const objectKeys = Object.keys(object);
    const objectKeysSet = new Set(objectKeys);
    const schemaKeys = Object.keys(schema.properties);
    const schemaKeysSet = new Set(schemaKeys);

    const extraKeys = objectKeys.filter((key) => !schemaKeysSet.has(key));
    if (extraKeys.length > 0)
        throw new TechnicalValidationError(`Unexpected keys: ${extraKeys.map((key) => JSON.stringify(key)).join(", ")}`);

    const missingKeys = schemaKeys.filter((key) => !objectKeysSet.has(key));
    if (missingKeys.length > 0)
        throw new TechnicalValidationError(`Missing keys: ${missingKeys.map((key) => JSON.stringify(key)).join(", ")}`);

    let res = true;
    for (const key of schemaKeys)
        res &&= validateObjectWithGbnfSchema(object[key], schema.properties[key]);

    return res;
}

function validateOneOf<T extends GbnfJsonOneOfSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T> {
    for (const item of schema.oneOf) {
        try {
            return validateObjectWithGbnfSchema(object, item);
        } catch (err) {
            if (err instanceof TechnicalValidationError)
                continue;

            throw err;
        }
    }

    throw new TechnicalValidationError(`Expected one of ${schema.oneOf.length} schemas but got ${JSON.stringify(object)}`);
}

function validateEnum<T extends GbnfJsonEnumSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T> {
    for (const value of schema.enum) {
        if (object === value)
            return true;
    }

    throw new TechnicalValidationError(`Expected one of [${
        schema.enum.map((item) => JSON.stringify(item)).join(", ")
    }] but got ${JSON.stringify(object)}`);
}

function validateConst<T extends GbnfJsonConstSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T> {
    if (object === schema.const)
        return true;

    throw new TechnicalValidationError(`Expected ${JSON.stringify(schema.const)} but got ${JSON.stringify(object)}`);
}

function validateImmutableType(value: any, type: GbnfJsonSchemaImmutableType) {
    if (type === "string") {
        return typeof value === "string";
    } else if (type === "number") {
        return typeof value === "number";
    } else if (type === "integer") {
        if (typeof value !== "number")
            return false;
        return value % 1 === 0;
    } else if (type === "boolean") {
        return typeof value === "boolean";
    } else if (type === "null") {
        return value === null;
    } else {
        void (type satisfies never);
    }

    throw new TechnicalValidationError(`Unknown immutable type ${JSON.stringify(type)}`);
}
