import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";
import {getUsedBinFlag} from "./usedBinFlag.js";
import {getClonedLlamaCppRepoReleaseTag} from "./cloneLlamaCppRepo.js";
import {getBinariesGithubRelease} from "./binariesGithubRelease.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function getReleaseInfo() {
    const [usedBinFlag, moduleVersion] = await Promise.all([
        getUsedBinFlag(),
        getModuleVersion()
    ]);

    const release = usedBinFlag === "prebuiltBinaries"
        ? await getBinariesGithubRelease()
        : (await getClonedLlamaCppRepoReleaseTag() ?? await getBinariesGithubRelease());

    return {
        llamaCpp: {
            binarySource: usedBinFlag === "prebuiltBinaries"
                ? "included"
                : "builtLocally",
            release
        },
        moduleVersion
    };
}

async function getModuleVersion(): Promise<string> {
    const packageJson = await fs.readJson(path.join(__dirname, "..", "..", "package.json"));

    return packageJson.version;
}
