import simpleGit, {SimpleGit} from "simple-git";
import cliProgress from "cli-progress";
import chalk from "chalk";
import fs from "fs-extra";
import {llamaCppDirectory} from "../config.js";
import {getGitBundlePathForRelease} from "./gitReleaseBundles.js";


export async function cloneLlamaCppRepo(githubOwner: string, githubRepo: string, tag: string) {
    const gitBundleForTag = await getGitBundlePathForRelease(githubOwner, githubRepo, tag);
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

                await simpleGit(llamaCppDirectory)
                    .removeRemote("origin");
                await simpleGit(llamaCppDirectory)
                    .addRemote("origin", remoteGitUrl);
            });
            return;
        } catch (err) {
            await fs.remove(llamaCppDirectory);
            console.error("Failed to clone git bundle, cloning from GitHub instead", err);
        }
    }

    await withGitCloneProgress("GitHub", async (gitWithCloneProgress) => {
        await gitWithCloneProgress.clone(remoteGitUrl, llamaCppDirectory, {
            "--depth": 1,
            "--branch": tag,
            "--quiet": null
        });
    });
}
