import retry from "async-retry";

export const ggufDefaultFetchRetryOptions: retry.Options = {
    retries: 10,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 1000 * 16
} as const;

export const defaultExtraAllocationSize = 1024 * 1024 * 4; // 4MB

export const noDirectSubNestingGGufMetadataKeys: readonly string[] = [
    "general.license",
    "tokenizer.chat_template"
];
