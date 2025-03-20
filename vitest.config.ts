import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        pool: "forks",
        maxWorkers: 1,
        minWorkers: 1,
        maxConcurrency: 1,
        poolOptions: {
            threads: {
                minThreads: 1,
                maxThreads: 1
            }
        },
        snapshotSerializers: [
            "./test/utils/helpers/llamaTextSerializer.ts",
            "./test/utils/helpers/SpecialTokensTextSerializer.ts",
            "./test/utils/helpers/SpecialTokenSerializer.ts"
        ],
        setupFiles: ["./test/utils/helpers/testSetup.ts"]
    }
});
