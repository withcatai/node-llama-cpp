import retry from "async-retry";

export const ggufDefaultFetchRetryOptions: retry.Options = {
    retries: 10,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 1000 * 16
} as const;

export const defaultExtraAllocationSize = 1024 * 1024 * 1.5; // 1.5MB
