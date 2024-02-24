import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        pool: "forks",
        maxWorkers: 1,
        minWorkers: 1,
        poolOptions: {
            threads: {
                minThreads: 1,
                maxThreads: 1
            }
        }
    }
});