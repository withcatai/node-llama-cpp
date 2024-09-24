import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";
// @ts-ignore
import {verifyConditions as githubVerifyConditions, success as githubSuccess} from "@semantic-release/github";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const brokenReleaseDryRunResult = fs.readJSONSync(path.join(__dirname, "semanticReleaseDryRunReleaseResult.json"));

console.log("Broken release dry run result:", brokenReleaseDryRunResult);

const githubPluginConfig = {};
const context = {
    ...brokenReleaseDryRunResult,
    options: {
        repositoryUrl: "https://github.com/withcatai/node-llama-cpp.git"
    },
    logger: console,
    env: process.env
};

await githubVerifyConditions(githubPluginConfig, context);
await githubSuccess(githubPluginConfig, context);
