import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";
// @ts-ignore
import {verifyConditions as githubVerifyConditions, success as githubSuccess} from "@semantic-release/github";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const brokenReleaseDryRunResult = fs.readJSONSync(path.join(__dirname, "resolved-next-release-artifact", "semanticReleaseDryRunReleaseResult.json"));

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

for (const release of context.releases) {
    if (release.pluginName === "@semantic-release/npm") {
        if (release.url == null) {
            release.name = "npm package (@latest dist-tag)";
            release.url = "https://www.npmjs.com/package/node-llama-cpp/v/" + release.version;
        }
    } else if (release.pluginName === "@semantic-release/github") {
        if (release.url == null) {
            release.name = "GitHub release";
            release.url = "https://github.com/withcatai/node-llama-cpp/releases/tag/" + release.gitTag;
        }
    }
}

await githubVerifyConditions(githubPluginConfig, context);
await githubSuccess(githubPluginConfig, context);
