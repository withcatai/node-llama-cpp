import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        poolOptions: {
            threads: {
                minThreads: 1,
                maxThreads: 1
            }
        }
    }
});
