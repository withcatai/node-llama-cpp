import chalk from "chalk";
import {BuildGpu} from "../../bindings/types.js";
import {getPrettyBuildGpuName} from "../../bindings/consts.js";

export function logUsedGpuTypeOption(gpu: BuildGpu) {
    if (gpu == false)
        console.log(`${chalk.yellow("GPU:")} disabled`);
    else
        console.log(`${chalk.yellow("GPU:")} ${getPrettyBuildGpuName(gpu)}`);
}
