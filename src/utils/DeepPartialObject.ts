export type DeepPartialObject<T, AllowedValueTypes> = T extends object
    ? {[P in keyof T]?: DeepPartialObject<T[P], AllowedValueTypes>}
    : T extends Array<infer I>
        ? AllowedValueTypes extends Array<any>
            ? Array<DeepPartialObject<I, AllowedValueTypes>>
            : never
        : T extends ReadonlyArray<infer I>
            ? AllowedValueTypes extends ReadonlyArray<any>
                ? ReadonlyArray<DeepPartialObject<I, AllowedValueTypes>>
                : never
            : AllowedValueTypes extends T
                ? T
                : never;
