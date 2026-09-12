import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {getCurrentNpmrcConfig, getNpmrcRegistry} from "../src/cli/utils/resolveNpmrcConfig.js";

const npmrcConfig = await getCurrentNpmrcConfig();
const npmRegistry = getNpmrcRegistry(npmrcConfig);
const interval = 1000 * 5;
const module = "node-llama-cpp";

import "./packTemplates.js";

const argv = await yargs(hideBin(process.argv))
    .option("packageVersion", {
        type: "string",
        demandOption: true
    })
    .option("additionalWait", {
        type: "number",
        default: 60
    })
    .option("timeoutMinutes", {
        type: "number",
        default: 10
    })
    .argv;

async function checkVersionExists(packageName: string, version: string): Promise<boolean> {
    const response = await fetch(
        npmRegistry.cleanRegistryUrl +
        (
            packageName
                .split("/")
                .map((item) => encodeURIComponent(item))
                .join("/")
        ) + `/${encodeURIComponent(version)}`
    );

    if (response.status === 404 || response.status === 500)
        return false;
    else if (response.status >= 200 && response.status < 300)
        return true;
    else if (!response.ok)
        throw new Error(`Failed to fetch package info for ${packageName} from registry ${npmRegistry}`);

    return false;
}

console.info(`Waiting for version ${module}@${argv.packageVersion} to appear in the registry for up to ${argv.timeoutMinutes} minutes...`);

const startTime = Date.now();
const maxEndTime = Date.now() + (1000 * 60 * argv.timeoutMinutes);
while (Date.now() < maxEndTime) {
    const exists = await checkVersionExists(module, argv.packageVersion);
    if (exists) {
        const timeDiff = Date.now() - startTime;
        console.info(`Version ${module}@${argv.packageVersion} exists in the registry. Waited for ${timeDiff / 1000} seconds.`);

        console.log(`Waiting an additional ${argv.additionalWait} seconds before exiting...`);
        await new Promise((resolve) => setTimeout(resolve, argv.additionalWait * 1000));

        console.log("Done waiting");
        process.exit(0);
        break;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
}

console.error(`Version ${module}@${argv.packageVersion} did not appear in the registry within ${argv.timeoutMinutes} minutes`);
process.exit(1);
