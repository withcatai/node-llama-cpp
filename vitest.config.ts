import {defineConfig, configDefaults} from "vitest/config";

export default defineConfig({
    test: {
        exclude: [
            ...configDefaults.exclude,
            "./llama"
        ],
        pool: "forks",
        maxWorkers: 1,
        maxConcurrency: 1,
        snapshotSerializers: [
            "./test/utils/helpers/llamaTextSerializer.ts",
            "./test/utils/helpers/SpecialTokensTextSerializer.ts",
            "./test/utils/helpers/SpecialTokenSerializer.ts"
        ],
        setupFiles: ["./test/utils/helpers/testSetup.ts"]

        // uncomment for profiling
        // execArgv: [
        //     "--cpu-prof",
        //     "--cpu-prof-dir=test-runner-profile",
        //     "--heap-prof",
        //     "--heap-prof-dir=test-runner-profile"
        // ]
    }
});
