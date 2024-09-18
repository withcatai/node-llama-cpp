/**
 * Makes all the properties of an object optional, including nested objects,
 * and strips all keys that their value is not of the specified allowed value types.
 */
export type OverridesObject<T, AllowedValueTypes> = T extends object
    ? {[P in keyof T]?: OverridesObject<T[P], AllowedValueTypes>}
    : T extends Array<infer I>
        ? AllowedValueTypes extends Array<any>
            ? Array<OverridesObject<I, AllowedValueTypes>>
            : never
        : T extends ReadonlyArray<infer I>
            ? AllowedValueTypes extends ReadonlyArray<any>
                ? ReadonlyArray<OverridesObject<I, AllowedValueTypes>>
                : never
            : AllowedValueTypes extends T
                ? T
                : never;
