import path from "path";
import simpleGit, {SimpleGit} from "simple-git";
import chalk from "chalk";
import fs from "fs-extra";
import which from "which";
import {
    defaultLlamaCppGitHubRepo, defaultLlamaCppRelease, enableRecursiveClone, llamaCppDirectory, llamaCppDirectoryInfoFilePath
} from "../../config.js";
import {getGitBundlePathForRelease} from "../../utils/gitReleaseBundles.js";
import {withLockfile} from "../../utils/withLockfile.js";
import {waitForLockfileRelease} from "../../utils/waitForLockfileRelease.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {isLockfileActive} from "../../utils/isLockfileActive.js";
import {isGithubReleaseNeedsResolving, resolveGithubRelease} from "../../utils/resolveGithubRelease.js";
import withStatusLogs from "../../utils/withStatusLogs.js";
import {withProgressLog} from "../../utils/withProgressLog.js";
import {logDistroInstallInstruction} from "./logDistroInstallInstruction.js";

type ClonedLlamaCppRepoTagFile = {
    tag: string,
    llamaCppGithubRepo: string
};


export async function cloneLlamaCppRepo(
    githubOwner: string, githubRepo: string, tag: string, useBundles: boolean = true, progressLogs: boolean = true,
    recursive: boolean = enableRecursiveClone
) {
    const gitBundleForTag = !useBundles ? null : await getGitBundlePathForRelease(githubOwner, githubRepo, tag);
    const remoteGitUrl = `https://github.com/${githubOwner}/${githubRepo}.git`;

    async function withGitCloneProgress<T>(cloneName: string, callback: (gitWithCloneProgress: SimpleGit) => Promise<T>): Promise<T> {
        if (!progressLogs)
            return await callback(simpleGit({}));

        const repoText = `${githubOwner}/${githubRepo} (${cloneName})`;

        let lastProgress = 0;
        let stages = 1;
        return await withProgressLog({
            loadingText: chalk.bold("Cloning " + repoText),
            successText: chalk.blue("Cloned " + repoText),
            failText: chalk.blue("Failed to clone " + repoText),
            progressFractionDigits: false
        }, async (progressUpdater) => {
            const gitWithCloneProgress = simpleGit({
                progress({progress}) {
                    const currentProgress = progress / 100;

                    if (currentProgress < lastProgress)
                        stages++;

                    lastProgress = currentProgress;

                    progressUpdater.setProgress(
                        currentProgress,
                        stages > 1
                            ? `(Stage ${stages})`
                            : undefined
                    );
                }
            });

            const res = await callback(gitWithCloneProgress);

            progressUpdater.setProgress(1);

            return res;
        });
    }

    await withLockfile({
        resourcePath: llamaCppDirectory
    }, async () => {
        await fs.remove(llamaCppDirectory);
        await fs.remove(llamaCppDirectoryInfoFilePath);

        if (gitBundleForTag != null) {
            try {
                await withGitCloneProgress("local bundle", async (gitWithCloneProgress) => {
                    await gitWithCloneProgress.clone(gitBundleForTag, llamaCppDirectory, {
                        "--quiet": null
                    });

                    await simpleGit(llamaCppDirectory).removeRemote("origin");
                });

                await updateClonedLlamaCppRepoTagFile(githubOwner, githubRepo, tag);

                return;
            } catch (err) {
                await fs.remove(llamaCppDirectory);
                await fs.remove(llamaCppDirectoryInfoFilePath);

                if (progressLogs)
                    console.error(getConsoleLogPrefix() + "Failed to clone git bundle, cloning from GitHub instead", err);

                await printCloneErrorHelp(String(err));
            }
        }

        try {
            await withGitCloneProgress("GitHub", async (gitWithCloneProgress) => {
                await gitWithCloneProgress.clone(remoteGitUrl, llamaCppDirectory, {
                    "--depth": 1,
                    "--branch": tag,
                    ...(recursive ? {"--recursive": null} : {}),
                    "--quiet": null
                });
            });

            await updateClonedLlamaCppRepoTagFile(githubOwner, githubRepo, tag);
        } catch (err) {
            await printCloneErrorHelp(String(err));

            throw err;
        }
    });
}

async function printCloneErrorHelp(error: string) {
    // This error happens with some docker images where the current user is different
    // from the owner of the files due to mounting a volume.
    // In such cases, print a helpful message to help the user resolve the issue.
    if (error.toLowerCase().includes("detected dubious ownership in repository"))
        console.info("\n" +
            getConsoleLogPrefix(true) + chalk.yellow("To fix this issue, try running this command to fix it for the current module directory:") + "\n" +
            'git config --global --add safe.directory "' + llamaCppDirectory + '"\n\n' +
            chalk.yellow("Or run this command to fix it everywhere:") + "\n" +
            'git config --global --add safe.directory "*"'
        );
    else if (await which("git", {nothrow: true}) == null) {
        console.info("\n" +
            getConsoleLogPrefix(true) + chalk.yellow("Git is not installed, please install it first to build llama.cpp")
        );
        await logDistroInstallInstruction("To install git, ", {
            linuxPackages: {apt: ["git"], apk: ["git"]},
            macOsPackages: {brew: ["git", "git-lfs"]}
        });
    }
}

export async function getClonedLlamaCppRepoReleaseInfo() {
    if (!(await isLlamaCppRepoCloned(false)))
        return null;

    if (!(await fs.pathExists(llamaCppDirectoryInfoFilePath)))
        return null;

    try {
        const clonedLlamaCppRepoTagJson: ClonedLlamaCppRepoTagFile = await fs.readJson(llamaCppDirectoryInfoFilePath);

        return clonedLlamaCppRepoTagJson;
    } catch (err) {
        console.error(getConsoleLogPrefix() + "Failed to read llama.cpp tag file", err);
        return null;
    }
}

export async function isLlamaCppRepoCloned(waitForLock: boolean = true) {
    if (waitForLock)
        await waitForLockfileRelease({resourcePath: llamaCppDirectory});
    else if (await isLockfileActive({resourcePath: llamaCppDirectory}))
        return false;

    const [
        repoGitExists,
        releaseInfoFileExists
    ] = await Promise.all([
        fs.pathExists(path.join(llamaCppDirectory, ".git")),
        fs.pathExists(llamaCppDirectoryInfoFilePath)
    ]);

    return repoGitExists && releaseInfoFileExists;
}

export async function ensureLlamaCppRepoIsCloned({progressLogs = true}: {progressLogs?: boolean} = {}) {
    if (await isLlamaCppRepoCloned(true))
        return;

    const [githubOwner, githubRepo] = defaultLlamaCppGitHubRepo.split("/");

    if (progressLogs)
        console.log(getConsoleLogPrefix() + chalk.blue("Cloning llama.cpp"));

    let releaseTag = defaultLlamaCppRelease;

    if (isGithubReleaseNeedsResolving(releaseTag)) {
        await withStatusLogs({
            loading: chalk.blue("Fetching llama.cpp info"),
            success: chalk.blue("Fetched llama.cpp info"),
            fail: chalk.blue("Failed to fetch llama.cpp info"),
            disableLogs: !progressLogs
        }, async () => {
            releaseTag = await resolveGithubRelease(githubOwner!, githubRepo!, releaseTag);
        });
    }

    await cloneLlamaCppRepo(githubOwner!, githubRepo!, releaseTag, true, progressLogs);
}

async function updateClonedLlamaCppRepoTagFile(githubOwner: string, githubRepo: string, tag: string) {
    try {
        const clonedLlamaCppRepoTagJson: ClonedLlamaCppRepoTagFile = {
            tag,
            llamaCppGithubRepo: githubOwner + "/" + githubRepo
        };

        await fs.writeJson(llamaCppDirectoryInfoFilePath, clonedLlamaCppRepoTagJson, {
            spaces: 4
        });
    } catch (err) {
        console.error(getConsoleLogPrefix() + "Failed to write llama.cpp tag file", err);

        throw err;
    }
}
