import {builtinLlamaCppGitHubRepo, builtinLlamaCppRelease} from "../../config.js";
import {getClonedLlamaCppRepoReleaseInfo} from "./cloneLlamaCppRepo.js";

export async function getCanUsePrebuiltBinaries() {
    const clonedLlamaCppRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();

    return clonedLlamaCppRepoReleaseInfo == null || (
        clonedLlamaCppRepoReleaseInfo.tag === builtinLlamaCppRelease &&
        clonedLlamaCppRepoReleaseInfo.llamaCppGithubRepo === builtinLlamaCppGitHubRepo
    );
}
