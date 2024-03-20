type UnionToIntersection<U> = (
    U extends any
        ? ((k: U) => void)
        : never
    ) extends ((k: infer I) => void)
        ? I
        : never;

type DistributeUnion<U> = {
    [K in keyof U]: U[K]
};
type OptionalDistributeUnion<U> = {
    [K in keyof U]?: U[K]
};

export type MergeUnionTypes<T> = DistributeUnion<UnionToIntersection<T>>;
export type MergeOptionalUnionTypes<T> = OptionalDistributeUnion<UnionToIntersection<T>>;
