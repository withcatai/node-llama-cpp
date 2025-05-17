import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        pool: "forks",
        maxWorkers: 1,
        minWorkers: 1,
        maxConcurrency: 1,
        poolOptions: {
            forks: {
                minForks: 1,
                maxForks: 1,
                singleFork: true

                // uncomment for profiling
                // execArgv: [
                //     "--cpu-prof",
                //     "--cpu-prof-dir=test-runner-profile",
                //     "--heap-prof",
                //     "--heap-prof-dir=test-runner-profile"
                // ]
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
