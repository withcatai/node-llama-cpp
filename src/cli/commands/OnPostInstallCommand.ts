import {CommandModule} from "yargs";
import {defaultSkipDownload} from "../../config.js";
import {getLlama} from "../../bindings/getLlama.js";

type OnPostInstallCommand = null;

export const OnPostInstallCommand: CommandModule<object, OnPostInstallCommand> = {
    command: "postinstall",
    describe: false,
    async handler() {
        if (defaultSkipDownload)
            return;

        try {
            await getLlama({
                progressLogs: true
            });
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
};
