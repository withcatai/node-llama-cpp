import {CommandModule} from "yargs";
import {
    defaultLlamaCppCudaSupport, defaultLlamaCppGitHubRepo, defaultLlamaCppMetalSupport, defaultLlamaCppRelease, defaultSkipDownload
} from "../../config.js";
import {getPrebuildBinPath} from "../../utils/getBin.js";
import {DownloadLlamaCppCommand} from "./DownloadCommand.js";

type OnPostInstallCommand = null;

export const OnPostInstallCommand: CommandModule<object, OnPostInstallCommand> = {
    command: "postinstall",
    describe: false,
    async handler() {
        if (defaultSkipDownload)
            return;

        if (await getPrebuildBinPath() != null)
            return;

        try {
            await DownloadLlamaCppCommand({
                repo: defaultLlamaCppGitHubRepo,
                release: defaultLlamaCppRelease,
                metal: defaultLlamaCppMetalSupport,
                cuda: defaultLlamaCppCudaSupport
            });
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
};
