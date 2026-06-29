import fs from "fs-extra";
import {binariesGithubReleasePath, llamaCppReleaseEnvVar} from "../../config.js";

type BinariesGithubReleaseFile = {
    release: "latest" | string
};

export async function getBinariesGithubRelease() {
    const binariesGithubRelease: BinariesGithubReleaseFile = await fs.readJson(binariesGithubReleasePath);

    return binariesGithubRelease.release;
}

export async function setBinariesGithubRelease(release: BinariesGithubReleaseFile["release"]) {
    const binariesGithubReleaseJson: BinariesGithubReleaseFile = {
        release: release
    };

    await fs.writeJson(binariesGithubReleasePath, binariesGithubReleaseJson, {
        spaces: 4
    });
}

export const builtinLlamaCppRelease = await getBinariesGithubRelease();
export const defaultLlamaCppRelease = llamaCppReleaseEnvVar || builtinLlamaCppRelease;
