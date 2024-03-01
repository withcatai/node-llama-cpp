import which from "which";
import chalk from "chalk";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {getPlatform} from "./getPlatform.js";

type DistroPackages = {
    linuxPackages?: {
        apt?: string[]
    },
    macOsPackages?: {
        brew?: string[]
    }
};

export async function logDistroInstallInstruction(prefixText: string, distroPackages: DistroPackages, {
    forceLogPrefix = false
}: {
    forceLogPrefix?: boolean
} = {}) {
    const instruction = await getDistroInstallInstruction(distroPackages);

    if (instruction == null)
        return;

    console.info(getConsoleLogPrefix(forceLogPrefix) + chalk.yellow(prefixText + instruction));
}

export async function getDistroInstallInstruction({
    linuxPackages,
    macOsPackages
}: DistroPackages) {
    const platform = getPlatform();

    if (platform === "linux") {
        if (linuxPackages == null)
            return null;

        if (linuxPackages.apt != null && linuxPackages.apt.length > 0) {
            const [
                sudoPath,
                aptPath
            ] = await Promise.all([
                which("sudo", {nothrow: true}),
                which("apt", {nothrow: true})
            ]);

            if (aptPath == null)
                return null;

            return 'you can run "' + (sudoPath != null ? "sudo " : "") + "apt install " + linuxPackages.apt.join(" ") + '"';
        }
    } else if (platform === "mac") {
        if (macOsPackages == null)
            return null;

        if (macOsPackages.brew != null && macOsPackages.brew.length > 0) {
            const brewPath = await which("brew", {nothrow: true});

            if (brewPath == null)
                return null;

            return 'you can run "brew install ' + macOsPackages.brew.join(" ") + '"';
        }
    }

    return null;
}
