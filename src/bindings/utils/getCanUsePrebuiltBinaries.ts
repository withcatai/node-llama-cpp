import {builtinLlamaCppGitHubRepo} from "../../config.js";
import {builtinLlamaCppRelease} from "./binariesGithubRelease.js";
import {getClonedLlamaCppRepoReleaseInfo} from "./cloneLlamaCppRepo.js";

export async function getCanUsePrebuiltBinaries() {
    const clonedLlamaCppRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();

    return clonedLlamaCppRepoReleaseInfo == null || (
        clonedLlamaCppRepoReleaseInfo.tag === builtinLlamaCppRelease &&
        clonedLlamaCppRepoReleaseInfo.llamaCppGithubRepo === builtinLlamaCppGitHubRepo
    );
}
