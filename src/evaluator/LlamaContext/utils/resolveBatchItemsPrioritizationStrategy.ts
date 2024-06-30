import {BatchingOptions} from "../types.js";
import {maximumParallelismStrategy} from "./batchItemsPrioritizationStrategies/maximumParallelismStrategy.js";
import {firstInFirstOutStrategy} from "./batchItemsPrioritizationStrategies/firstInFirstOutStrategy.js";

export function resolveBatchItemsPrioritizationStrategy(strategy: Required<BatchingOptions>["itemPrioritizationStrategy"]) {
    if (strategy instanceof Function)
        return strategy;
    else if (strategy === "maximumParallelism")
        return maximumParallelismStrategy;
    else if (strategy === "firstInFirstOut")
        return firstInFirstOutStrategy;

    void (strategy satisfies never);

    throw new Error(`Unknown batch items prioritize strategy: ${strategy}`);
}
