import path from "path";
import {fileURLToPath} from "url";
import {CommandModule} from "yargs";
import chalk from "chalk";
import {defaultSkipDownload, documentationPageUrls, defaultNodeLlamaCppPostinstall} from "../../config.js";
import {getLlamaForOptions} from "../../bindings/getLlama.js";
import {setForceShowConsoleLogPrefix} from "../../state.js";
import {isRunningUnderRosetta} from "../utils/isRunningUnderRosetta.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {parsePackageJsonConfig, resolvePackageJsonConfig} from "../utils/packageJsonConfig.js";
import {detectCurrentPackageManager} from "../utils/packageManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type OnPostInstallCommand = null;

export const OnPostInstallCommand: CommandModule<object, OnPostInstallCommand> = {
    command: "postinstall",
    describe: false,
    async handler() {
        if (defaultSkipDownload)
            return void process.exit(0);

        const nlcConfig = parsePackageJsonConfig(await resolvePackageJsonConfig(__dirname));
        const postinstallConfig = (defaultNodeLlamaCppPostinstall == null || defaultNodeLlamaCppPostinstall === "auto")
            ? nlcConfig.nodeLlamaCppPostinstall ?? defaultNodeLlamaCppPostinstall
            : defaultNodeLlamaCppPostinstall;

        // set via a `--node-llama-cpp-postinstall=skip` flag on an `npm install` command
        //  (prefer `--node-llama-cpp-postinstall=ignoreFailedBuild` if you really need it)
        if (postinstallConfig === "skip") {
            console.info(
                getConsoleLogPrefix(false, false),
                "Skipping node-llama-cpp postinstall due to a 'skip' configuration"
            );
            return void process.exit(0);
        }

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

            if (postinstallConfig === "ignoreFailedBuild")
                process.exit(0);
            else
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

            const packageManager = detectCurrentPackageManager();
            if (postinstallConfig === "auto" && packageManager === "npm")
                console.info(
                    getConsoleLogPrefix(false, false),
                    "To disable node-llama-cpp's postinstall for this 'npm install', use the '--node-llama-cpp-postinstall=skip' flag when running 'npm install' command"
                );

            if (postinstallConfig === "auto")
                console.info(
                    getConsoleLogPrefix(false, false),
                    "To customize node-llama-cpp's postinstall behavior, see the troubleshooting guide: " +
                    documentationPageUrls.troubleshooting.PostinstallBehavior
                );

            if (postinstallConfig === "ignoreFailedBuild")
                process.exit(0);
            else
                process.exit(1);
        }
    }
};
