import * as path from "path";
import {CommandModule} from "yargs";
import {Octokit} from "octokit";
import * as fs from "fs-extra";
import chalk from "chalk";
import {DownloaderHelper} from "node-downloader-helper";
import cliProgress from "cli-progress";
import bytes from "bytes";
import StreamZip from "node-stream-zip";
import {defaultLlamaCppGitHubRepo, defaultLlamaCppRelease, llamaCppDirectory, tempDownloadDirectory} from "../../config.js";
import {compileLlamaCpp} from "../../utils/compileLLamaCpp.js";
import withOra from "../../utils/withOra.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";
import {setBinariesGithubRelease} from "../../utils/binariesGithubRelease.js";

type DownloadCommandArgs = {
    repo: string,
    release: "latest" | string,
    arch?: string,
    nodeTarget?: string,
    skipBuild?: boolean,
    updateBinariesReleaseMetadata?: boolean
};

export const DownloadCommand: CommandModule<object, DownloadCommandArgs> = {
    command: "download",
    describe: "Download a release of llama.cpp and compile it",
    builder(yargs) {
        return yargs
            .option("repo", {
                type: "string",
                default: defaultLlamaCppGitHubRepo,
                description: "The GitHub repository to download a release of llama.cpp from. Can also be set via the NODE_LLAMA_CPP_REPO environment variable"
            })
            .option("release", {
                type: "string",
                default: defaultLlamaCppRelease,
                description: "The tag of the llama.cpp release to download. Set to \"latest\" to download the latest release. Can also be set via the NODE_LLAMA_CPP_REPO_RELEASE environment variable"
            })
            .option("arch", {
                type: "string",
                description: "The architecture to compile llama.cpp for"
            })
            .option("nodeTarget", {
                type: "string",
                description: "The Node.js version to compile llama.cpp for. Example: v18.0.0"
            })
            .option("skipBuild", {
                type: "boolean",
                default: false,
                description: "Skip building llama.cpp after downloading it"
            })
            .option("updateBinariesReleaseMetadata", {
                type: "boolean",
                hidden: true, // this for the CI to use
                default: false,
                description: "Update the binariesGithubRelease.json file with the release of llama.cpp that was downloaded"
            });
    },
    handler: DownloadLlamaCppCommand
};

export async function DownloadLlamaCppCommand({
    repo, release, arch, nodeTarget, skipBuild, updateBinariesReleaseMetadata
}: DownloadCommandArgs) {
    const octokit = new Octokit();
    const [githubOwner, githubRepo] = repo.split("/");

    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    console.log();

    type GithubReleaseType = Awaited<ReturnType<typeof octokit.rest.repos.getLatestRelease>> |
        Awaited<ReturnType<typeof octokit.rest.repos.getReleaseByTag>>;

    let githubRelease: GithubReleaseType | null = null;
    let zipUrl: string;
    await withOra({
        loading: chalk.blue("Fetching llama.cpp info"),
        success: chalk.blue("Fetched llama.cpp info"),
        fail: chalk.blue("Failed to fetch llama.cpp info")
    }, async () => {
        try {
            if (release === "latest") {
                githubRelease = await octokit.rest.repos.getLatestRelease({
                    owner: githubOwner,
                    repo: githubRepo
                });
            } else {
                githubRelease = await octokit.rest.repos.getReleaseByTag({
                    owner: githubOwner,
                    repo: githubRepo,
                    tag: release
                });
            }
        } catch (err) {
            console.error("Failed to fetch llama.cpp release info", err);
        }

        if (githubRelease == null) {
            throw new Error(`Failed to find release "${release}" of "${repo}"`);
        }

        if (githubRelease.data?.zipball_url == null) {
            throw new Error(`Failed to find a zip archive for release "${release}" of "${repo}"`);
        }

        const zipUrlResponse = await octokit.rest.repos.downloadZipballArchive({
            owner: githubOwner,
            repo: githubRepo,
            ref: githubRelease!.data.target_commitish
        });

        if (zipUrlResponse.url == null)
            throw new Error(`Failed to get zip archive url for release "${release}" of "${repo}"`);

        zipUrl = zipUrlResponse.url;
    });

    await clearTempFolder();


    console.log(chalk.blue("Downloading zip file"));
    await fs.ensureDir(tempDownloadDirectory);
    await downloadFile(zipUrl!, "llama.cpp.zip", tempDownloadDirectory);

    await withOra({
        loading: chalk.blue("Removing existing llama.cpp directory"),
        success: chalk.blue("Removed existing llama.cpp directory"),
        fail: chalk.blue("Failed to remove existing llama.cpp directory")
    }, async () => {
        await fs.remove(llamaCppDirectory);
    });

    await withOra({
        loading: chalk.blue("Extracting llama.cpp.zip file"),
        success: chalk.blue("Extracted llama.cpp.zip file"),
        fail: chalk.blue("Failed to extract llama.cpp.zip file")
    }, async () => {
        await unzipLlamaReleaseZipFile(path.join(tempDownloadDirectory, "llama.cpp.zip"), llamaCppDirectory);
    });

    await withOra({
        loading: chalk.blue("Removing temporary files"),
        success: chalk.blue("Removed temporary files"),
        fail: chalk.blue("Failed to remove temporary files")
    }, async () => {
        await clearTempFolder();
    });

    if (!skipBuild) {
        console.log(chalk.blue("Compiling llama.cpp"));
        await compileLlamaCpp({
            arch: arch ? arch : undefined,
            nodeTarget: nodeTarget ? nodeTarget : undefined,
            setUsedBingFlag: true
        });
    }

    if (updateBinariesReleaseMetadata) {
        await setBinariesGithubRelease(githubRelease!.data.tag_name);
    }

    console.log();
    console.log();
    console.log(`${chalk.yellow("Repo:")} ${repo}`);
    console.log(`${chalk.yellow("Release:")} ${release}`);
    console.log();
    console.log(chalk.green("Done"));
}


async function downloadFile(url: string, fileName: string, directory: string) {
    const download = new DownloaderHelper(url, directory, {
        fileName: fileName,
        retry: {
            maxRetries: 10,
            delay: 1000 * 6
        }
    });

    const progressBar = new cliProgress.Bar({
        clearOnComplete: false,
        hideCursor: true,
        autopadding: true,
        format: `${chalk.bold("{filename}")}  ${chalk.yellow("{percentage}%")} ${chalk.cyan("{bar}")} {speed}${chalk.grey("{eta_formatted}")}`
    }, cliProgress.Presets.shades_classic);
    progressBar.start(100, 0, {
        speed: "",
        filename: fileName
    });

    download.on("progress", (stats) => {
        progressBar.update(Math.floor((stats.downloaded / stats.total) * 10000) / 100, {
            speed: Number.isFinite(stats.speed) ? chalk.blue((bytes(stats.speed) + "/s").padEnd(10)) + chalk.grey(" | ") : ""
        });
    });
    download.on("end", () => {
        progressBar.update(100);
        progressBar.stop();
    });

    // errors are handled by the .start() method
    // this listener is here to not get an unhandled error exception
    download.on("error", () => {});

    await download.start();
}

async function unzipLlamaReleaseZipFile(zipFilePath: string, directory: string) {
    const zip = new StreamZip.async({file: zipFilePath});

    const entires = await zip.entries();
    const rootFolderEntries = new Map<string, number>();

    for (const entry of Object.values(entires)) {
        const entryPath = entry.name.split("/");
        const rootFolderName = entryPath[0];
        const rootFolderEntryCount = rootFolderEntries.get(rootFolderName) ?? 0;
        rootFolderEntries.set(rootFolderName, rootFolderEntryCount + 1);
    }

    const mostUsedRootFolderName = [...rootFolderEntries.keys()]
        .sort((a, b) => rootFolderEntries.get(b)! - rootFolderEntries.get(a)!)
        .shift();

    if (mostUsedRootFolderName == null)
        throw new Error("Failed to find the root folder of the llama.cpp release zip file");

    await zip.extract(mostUsedRootFolderName, directory);
}
