import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        pool: "typescript",
        poolOptions: {
            threads: {
                minThreads: 1,
                maxThreads: 1
            }
        }
    }
});
