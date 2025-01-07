export type Writable<T> = {
    -readonly [P in keyof T]: T[P];
};

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
