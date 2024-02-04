import {BatchingOptions} from "../types.js";
import {maximumParallelismStrategy} from "./batchItemsPrioritizingStrategies/maximumParallelismStrategy.js";
import {firstInFirstOutStrategy} from "./batchItemsPrioritizingStrategies/firstInFirstOutStrategy.js";

export function resolveBatchItemsPrioritizingStrategy(strategy: Required<BatchingOptions>["itemsPrioritizingStrategy"]) {
    if (strategy instanceof Function)
        return strategy;
    else if (strategy === "maximumParallelism")
        return maximumParallelismStrategy;
    else if (strategy === "firstInFirstOut")
        return firstInFirstOutStrategy;

    void (strategy satisfies never);

    throw new Error(`Unknown batch items prioritize strategy: ${strategy}`);
}
