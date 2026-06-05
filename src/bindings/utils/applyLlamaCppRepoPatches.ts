import path from "path";
import fs from "fs-extra";
import {simpleGit} from "simple-git";
import {GitHubClient} from "../../utils/GitHubClient.js";
import {defaultLlamaCppRepoSkipPatches, llamaCppDirectory, llamaCppPatchesDirectory} from "../../config.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";

type RepoPatch = {
    filename: string,
    title: string,
    canSkip(repoPath: string, lastCommitDate?: Date): Promise<boolean>
};

const patches: RepoPatch[] = [{
    // https://github.com/ggml-org/llama.cpp/pull/22566
    filename: "PR-22566.diff",
    title: "fix: consistent memory breakdown for models loaded with `no_alloc`",
    async canSkip(repoPath, lastCommitDate) {
        const llamaModelLoaderCpp = await fs.readFile(path.join(repoPath, "src", "llama-model-loader.cpp"), "utf8");
        if (!llamaModelLoaderCpp.includes("n_tensors = weights_map.size();") && llamaModelLoaderCpp.includes("n_tensors = gguf_get_n_tensors(metadata);"))
            return true;

        if (lastCommitDate == null)
            return false;

        try {
            const githubClient = new GitHubClient();
            const pullRequestStatus = await githubClient.getPullRequestStatus({
                owner: "ggml-org",
                repo: "llama.cpp",
                id: "22566"
            });
    
            if (pullRequestStatus.merged && pullRequestStatus.merged_at != null) {
                const mergedAt = new Date(pullRequestStatus.merged_at);
                if (+mergedAt >= +lastCommitDate)
                    return true;
            }
        } catch (err) {
            // do nothing
        }

        return false;
    }
}];

export function hasLlamaCppRepoPatchesToApply() {
    return patches.length > 0;
}

export async function applyLlamaCppRepoPatches(lastCommitDate?: Date, throwOnError: boolean = false, progressLogs: boolean | "stderr" = "stderr") {
    if (!hasLlamaCppRepoPatchesToApply() || (defaultLlamaCppRepoSkipPatches.length === 1 && defaultLlamaCppRepoSkipPatches[0] === "*"))
        return;

    if (!(await fs.pathExists(llamaCppPatchesDirectory)) || !(await fs.pathExists(llamaCppDirectory)))
        return;

    const git = simpleGit({baseDir: llamaCppDirectory});
    for (const patch of patches) {
        const patchPath = path.join(path.resolve(llamaCppPatchesDirectory), patch.filename);

        const filenameWithoutDiff = patch.filename.toLowerCase().endsWith(".diff")
            ? patch.filename.slice(0, -".diff".length)
            : patch.filename;

        if (defaultLlamaCppRepoSkipPatches.includes(filenameWithoutDiff) || defaultLlamaCppRepoSkipPatches.includes(patch.filename))
            continue;

        try {
            if (!(await fs.pathExists(patchPath))) {
                if (progressLogs !== false)
                    console.warn(`Patch file "${patch.filename}" not found, skipping patch "${patch.title}"`);
                
                continue;
            }

            if (await patch.canSkip(llamaCppDirectory, lastCommitDate))
                continue;
        } catch (err) {
            if (progressLogs !== false)
                console.warn(
                    getConsoleLogPrefix(),
                    `Failed testing whether patch "${patch.filename}": "${patch.title}" can be skipped:`,
                    String(err)
                );
        }

        try {
            await git.applyPatch(patchPath, {"--ignore-whitespace": null});
        } catch (err) {
            if (progressLogs !== false)
                console.error(
                    getConsoleLogPrefix(),
                    `Failed to apply patch "${patch.filename}": "${patch.title}", building llama.cpp may fail.`,
                    String(err)
                );

            if (throwOnError)
                throw err;
        }
    }
}
