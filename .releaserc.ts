import {createRequire} from "module";
import fs from "fs-extra";
import {getBinariesGithubRelease} from "./dist/bindings/utils/binariesGithubRelease.js";
import {cliBinName, defaultLlamaCppGitHubRepo} from "./dist/config.js";

import type {GlobalConfig, Result as SemanticReleaseDryRunResult} from "semantic-release";

const require = createRequire(import.meta.url);

// source: conventional-changelog-writer/templates/footer.hbs
const defaultFooterTemplate = `
{{#if noteGroups}}
{{#each noteGroups}}

### {{title}}

{{#each notes}}
* {{text}}
{{/each}}
{{/each}}
{{/if}}
`.slice(1, -1);
const binariesSourceRelease = await getBinariesGithubRelease();
const homepageUrl = require("./package.json").homepage;
const homepageUrlWithoutTrailingSlash = homepageUrl.endsWith("/")
    ? homepageUrl.slice(0, -1)
    : homepageUrl;

/* eslint-disable @stylistic/max-len */
const newFooterTemplate = defaultFooterTemplate + "\n---\n\n" +
    `Shipped with \`llama.cpp\` release [\`${binariesSourceRelease.split("`").join("")}\`](https://github.com/${defaultLlamaCppGitHubRepo}/releases/tag/${encodeURIComponent(binariesSourceRelease)})\n\n` +
    `> To use the latest \`llama.cpp\` release available, run \`npx -n ${cliBinName} source download --release latest\`. ([learn more](${homepageUrlWithoutTrailingSlash}/guide/building-from-source#download-new-release))\n`;
/* eslint-enable @stylistic/max-len */

const githubPluginConfig = {
    discussionCategoryName: "Releases" as string | boolean
};

const config: Omit<GlobalConfig, "repositoryUrl" | "tagFormat"> = {
    branches: [
        "master",
        {name: "beta", prerelease: true}
    ],
    ci: true,
    plugins: [
        ["@semantic-release/commit-analyzer", {
            preset: "angular",
            releaseRules: [
                {type: "feat", scope: "minor", release: "patch"},
                {type: "docs", scope: "README", release: "patch"}
            ]
        }],
        ["@semantic-release/release-notes-generator", {
            writerOpts: {
                footerPartial: newFooterTemplate,

                // ensure that the "Features" group comes before the "Bug Fixes" group
                commitGroupsSort(a: {title: string}, b: {title: string}) {
                    const order = ["Features", "Bug Fixes"];
                    const aIndex = order.indexOf(a?.title);
                    const bIndex = order.indexOf(b?.title);

                    if (aIndex >= 0 && bIndex >= 0)
                        return aIndex - bIndex;
                    else if (aIndex >= 0)
                        return -1;
                    else if (bIndex >= 0)
                        return 1;

                    return (a?.title || "").localeCompare(b?.title || "");
                }
            }
        }],
        ["@semantic-release/exec", {
            publishCmd: "npx --no vite-node ./scripts/publishStandalonePrebuiltBinaryModules.ts --packageVersion \"${nextRelease.version}\""
        }],
        "@semantic-release/npm",
        ["@semantic-release/github", githubPluginConfig],
        ["@semantic-release/exec", {
            publishCmd: "echo \"${nextRelease.version}\" > .semanticRelease.npmPackage.deployedVersion.txt"
        }]
    ]
};

function getDryRunResult() {
    try {
        const dryRunResultEnvVarValue = process.env.DRY_RUN_RESULT_FILE_PATH;
        if (dryRunResultEnvVarValue == null)
            return null;

        const dryRunResultValue = fs.readFileSync(dryRunResultEnvVarValue, "utf8");

        const res: SemanticReleaseDryRunResult = JSON.parse(dryRunResultValue);
        if (res === false)
            return null;

        console.log("Dry run result:", res);
        return res;
    } catch (err) {
        // do nothing
    }

    return null;
}

const dryRunResult = getDryRunResult();
console.info("Next release type", dryRunResult?.nextRelease?.type);
if (dryRunResult == null || !(dryRunResult.nextRelease.type === "major" || dryRunResult.nextRelease.type === "minor"))
    githubPluginConfig.discussionCategoryName = false;

export default config;
