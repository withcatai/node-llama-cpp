import path from "path";
import simpleGit, {SimpleGit} from "simple-git";
import cliProgress from "cli-progress";
import chalk from "chalk";
import fs from "fs-extra";
import {defaultLlamaCppGitHubRepo, defaultLlamaCppRelease, llamaCppDirectory, llamaCppDirectoryInfoFilePath} from "../../config.js";
import {getGitBundlePathForRelease} from "../../utils/gitReleaseBundles.js";
import {withLockfile} from "../../utils/withLockfile.js";
import {waitForLockfileRelease} from "../../utils/waitForLockfileRelease.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {isLockfileActive} from "../../utils/isLockfileActive.js";
import {isGithubReleaseNeedsResolving, resolveGithubRelease} from "../../utils/resolveGithubRelease.js";
import withStatusLogs from "../../utils/withStatusLogs.js";

type ClonedLlamaCppRepoTagFile = {
    tag: string,
    llamaCppGithubRepo: string
};


export async function cloneLlamaCppRepo(
    githubOwner: string, githubRepo: string, tag: string, useBundles: boolean = true, progressLogs: boolean = true
) {
    const gitBundleForTag = !useBundles ? null : await getGitBundlePathForRelease(githubOwner, githubRepo, tag);
    const remoteGitUrl = `https://github.com/${githubOwner}/${githubRepo}.git`;

    async function withGitCloneProgress<T>(cloneName: string, callback: (gitWithCloneProgress: SimpleGit) => Promise<T>): Promise<T> {
        if (!progressLogs)
            return await callback(simpleGit({}));

        const progressBar = new cliProgress.Bar({
            clearOnComplete: false,
            hideCursor: true,
            autopadding: true,
            format: getConsoleLogPrefix() + `${chalk.bold("Clone {repo}")}  ${chalk.yellow("{percentage}%")} ${chalk.cyan("{bar}")} ${chalk.grey("{eta_formatted}")}`
        }, cliProgress.Presets.shades_classic);

        progressBar.start(100, 0, {
            speed: "",
            repo: `${githubOwner}/${githubRepo} (${cloneName})`
        });

        const gitWithCloneProgress = simpleGit({
            progress({progress, total, processed}) {
                const totalProgress = (processed / 100) + (progress / total);

                progressBar.update(Math.floor(totalProgress * 10000) / 100);
            }
        });

        try {
            const res = await callback(gitWithCloneProgress);

            progressBar.update(100);

            return res;
        } finally {
            progressBar.stop();
        }
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

                printCloneErrorHelp(String(err));
            }
        }

        try {
            await withGitCloneProgress("GitHub", async (gitWithCloneProgress) => {
                await gitWithCloneProgress.clone(remoteGitUrl, llamaCppDirectory, {
                    "--depth": 1,
                    "--branch": tag,
                    "--quiet": null
                });
            });

            await updateClonedLlamaCppRepoTagFile(githubOwner, githubRepo, tag);
        } catch (err) {
            printCloneErrorHelp(String(err));

            throw err;
        }
    });
}

function printCloneErrorHelp(error: string) {
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
            releaseTag = await resolveGithubRelease(githubOwner, githubRepo, releaseTag);
        });
    }

    await cloneLlamaCppRepo(githubOwner, githubRepo, releaseTag, true, progressLogs);
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
