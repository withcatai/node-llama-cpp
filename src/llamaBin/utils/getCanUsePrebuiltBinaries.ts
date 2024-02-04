import {getClonedLlamaCppRepoReleaseInfo} from "../../utils/cloneLlamaCppRepo.js";
import {builtinLlamaCppGitHubRepo, builtinLlamaCppRelease} from "../../config.js";

export async function getCanUsePrebuiltBinaries() {
    const clonedLlamaCppRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();

    return clonedLlamaCppRepoReleaseInfo == null || (
        clonedLlamaCppRepoReleaseInfo.tag === builtinLlamaCppRelease &&
        clonedLlamaCppRepoReleaseInfo.llamaCppGithubRepo === builtinLlamaCppGitHubRepo
    );
}
