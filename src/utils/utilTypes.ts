export type Writable<T> = {
    -readonly [P in keyof T]: T[P];
};

/**
 * Omit all the keys from `Value` that are not present in `Options` and are `true`.
 *
 * For example:
 * ```ts
 * type Value = {a: number, b: string, c: boolean};
 * type Options = {a: true, b: false, c: true};
 * type Result = PickOptions<Value, Options>; // {a: number, c: boolean}
 * ```
 */
export type PickOptions<
    Value extends Readonly<Record<string, any>>,
    Options extends {readonly [key: string]: boolean | undefined}
> = Pick<Value, {
    [Key in keyof Value]: Key extends keyof Options
        ? Options[Key] extends true
            ? Key
            : never
        : never
}[keyof Value]>;
