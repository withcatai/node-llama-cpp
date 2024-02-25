import chalk from "chalk";
import {BinaryPlatform, getPlatform} from "../../bindings/utils/getPlatform.js";

export function logEnabledComputeLayers({
    metal, cuda, vulkan
}: {
    metal: boolean, cuda: boolean, vulkan: boolean
}, {
    platform = getPlatform()
}: {
    platform?: BinaryPlatform
} = {}) {
    if (metal && platform === "mac")
        console.log(`${chalk.yellow("Metal:")} enabled`);

    if (cuda)
        console.log(`${chalk.yellow("CUDA:")} enabled`);

    if (vulkan)
        console.log(`${chalk.yellow("Vulkan:")} enabled`);
}
