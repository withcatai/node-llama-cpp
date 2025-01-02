import {CommandModule} from "yargs";
import chalk from "chalk";
import {defaultSkipDownload, documentationPageUrls} from "../../config.js";
import {getLlamaForOptions} from "../../bindings/getLlama.js";
import {setForceShowConsoleLogPrefix} from "../../state.js";
import {isRunningUnderRosetta} from "../utils/isRunningUnderRosetta.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";

type OnPostInstallCommand = null;

export const OnPostInstallCommand: CommandModule<object, OnPostInstallCommand> = {
    command: "postinstall",
    describe: false,
    async handler() {
        if (defaultSkipDownload)
            return;

        setForceShowConsoleLogPrefix(true);

        if (await isRunningUnderRosetta()) {
            console.error(
                getConsoleLogPrefix(false, false),
                chalk.red(
                    "llama.cpp is not supported under Rosetta on Apple Silicone Macs. " +
                    "Ensure that you're using a native arm64 node.js installation."
                )
            );
            console.error(
                getConsoleLogPrefix(false, false),
                "process.platform: " + process.platform + ", process.arch: " + process.arch
            );
            console.error(
                getConsoleLogPrefix(false, false),
                "troubleshooting: " + documentationPageUrls.troubleshooting.RosettaIllegalHardwareInstruction
            );

            process.exit(1);
        }

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
