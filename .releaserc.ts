import {createRequire} from "module";
import fs from "fs-extra";
import {getBinariesGithubRelease} from "./dist/bindings/utils/binariesGithubRelease.js";
import {cliBinName, defaultLlamaCppGitHubRepo} from "./dist/config.js";

const require = createRequire(import.meta.url);

const defaultFooterTemplatePath = require.resolve("conventional-changelog-writer/templates/footer.hbs");
const defaultFooterTemplate = await fs.readFile(defaultFooterTemplatePath, "utf8");
const binariesSourceRelease = await getBinariesGithubRelease();
const homepageUrl = require("./package.json").homepage;
const homepageUrlWithoutTrailingSlash = homepageUrl.endsWith("/")
    ? homepageUrl.slice(0, -1)
    : homepageUrl;

const newFooterTemplate = defaultFooterTemplate + "\n---\n\n" +
    `Shipped with \`llama.cpp\` release [\`${binariesSourceRelease.split("`").join("")}\`](https://github.com/${defaultLlamaCppGitHubRepo}/releases/tag/${encodeURIComponent(binariesSourceRelease)})\n\n` +
    `> To use the latest \`llama.cpp\` release available, run \`npx --no ${cliBinName} download --release latest\`. ([learn more](${homepageUrlWithoutTrailingSlash}/guide/building-from-source#downloading-a-newer-release))\n`;

/**
 * @type {import("semantic-release").GlobalConfig}
 */
export default {
    "branches": [
        "master",
        {"name": "beta", "prerelease": true}
    ],
    "ci": true,
    "plugins": [
        ["@semantic-release/commit-analyzer", {
            "preset": "angular",
            "releaseRules": [
                {"type": "feat", "scope": "minor", "release": "patch"},
                {"type": "docs", "scope": "README", "release": "patch"}
            ]
        }],
        ["@semantic-release/release-notes-generator", {
            "writerOpts": {
                "footerPartial": newFooterTemplate
            }
        }],
        ["@semantic-release/exec", {
            "publishCmd": "npx --no vite-node ./scripts/publishStandalonePrebuiltBinaryModules.ts --packageVersion \"${nextRelease.version}\""
        }],
        "@semantic-release/npm",
        ["@semantic-release/github", {
            "discussionCategoryName": "Releases"
        }],
        ["@semantic-release/exec", {
            "publishCmd": "echo \"${nextRelease.version}\" > .semanticRelease.npmPackage.deployedVersion.txt"
        }]
    ]
};
