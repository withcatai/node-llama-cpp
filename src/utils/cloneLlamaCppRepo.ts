import simpleGit, {SimpleGit} from "simple-git";
import cliProgress from "cli-progress";
import chalk from "chalk";
import fs from "fs-extra";
import {llamaCppDirectory, llamaCppDirectoryTagFilePath} from "../config.js";
import {getGitBundlePathForRelease} from "./gitReleaseBundles.js";

type ClonedLlamaCppRepoTagFile = {
    tag: string
};


export async function cloneLlamaCppRepo(githubOwner: string, githubRepo: string, tag: string, useBundles: boolean = true) {
    const gitBundleForTag = !useBundles ? null : await getGitBundlePathForRelease(githubOwner, githubRepo, tag);
    const remoteGitUrl = `https://github.com/${githubOwner}/${githubRepo}.git`;

    async function withGitCloneProgress<T>(cloneName: string, callback: (gitWithCloneProgress: SimpleGit) => Promise<T>): Promise<T> {
        const progressBar = new cliProgress.Bar({
            clearOnComplete: false,
            hideCursor: true,
            autopadding: true,
            format: `${chalk.bold("Clone {repo}")}  ${chalk.yellow("{percentage}%")} ${chalk.cyan("{bar}")} ${chalk.grey("{eta_formatted}")}`
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

    if (gitBundleForTag != null) {
        try {
            await withGitCloneProgress("local bundle", async (gitWithCloneProgress) => {
                await gitWithCloneProgress.clone(gitBundleForTag, llamaCppDirectory, {
                    "--quiet": null
                });

                await simpleGit(llamaCppDirectory).removeRemote("origin");
            });
            return;
        } catch (err) {
            await fs.remove(llamaCppDirectory);
            await fs.remove(llamaCppDirectoryTagFilePath);
            console.error("Failed to clone git bundle, cloning from GitHub instead", err);

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
    } catch (err) {
        printCloneErrorHelp(String(err));

        throw err;
    }

    try {
        const clonedLlamaCppRepoTagJson: ClonedLlamaCppRepoTagFile = {
            tag
        };

        await fs.writeJson(llamaCppDirectoryTagFilePath, clonedLlamaCppRepoTagJson, {
            spaces: 4
        });
    } catch (err) {
        console.error("Failed to write llama.cpp tag file", err);

        throw err;
    }
}

function printCloneErrorHelp(error: string) {
    // This error happens with some docker images where the current user is different
    // from the owner of the files due to mounting a volume.
    // In such cases, print a helpful message to help the user resolve the issue.
    if (error.toLowerCase().includes("detected dubious ownership in repository"))
        console.info("\n" +
            chalk.grey("[node-llama-cpp]") + chalk.yellow(" To fix this issue, try running this command to fix it for the current module directory:") + "\n" +
            'git config --global --add safe.directory "' + llamaCppDirectory + '"\n\n' +
            chalk.yellow("Or run this command to fix it everywhere:") + "\n" +
            'git config --global --add safe.directory "*"'
        );
}

export async function getClonedLlamaCppRepoReleaseTag() {
    if (!(await fs.pathExists(llamaCppDirectoryTagFilePath)))
        return null;

    try {
        const clonedLlamaCppRepoTagJson: ClonedLlamaCppRepoTagFile = await fs.readJson(llamaCppDirectoryTagFilePath);

        return clonedLlamaCppRepoTagJson.tag;
    } catch (err) {
        console.error("Failed to read llama.cpp tag file", err);
        return null;
    }
}
