import {CommandModule} from "yargs";
import {defaultSkipDownload} from "../../config.js";
import {getLlamaForOptions} from "../../bindings/getLlama.js";
import {setForceShowConsoleLogPrefix} from "../../state.js";

type OnPostInstallCommand = null;

export const OnPostInstallCommand: CommandModule<object, OnPostInstallCommand> = {
    command: "postinstall",
    describe: false,
    async handler() {
        if (defaultSkipDownload)
            return;

        setForceShowConsoleLogPrefix(false);

        try {
            await getLlamaForOptions({
                progressLogs: true
            }, {
                updateLastBuildInfoOnCompile: true
            });

            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
};
