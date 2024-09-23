import which from "which";
import chalk from "chalk";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {getPlatform} from "./getPlatform.js";

type DistroPackages = {
    linuxPackages?: {
        apt?: string[],
        apk?: string[]
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

            if (aptPath != null) {
                const aptCommand = (sudoPath != null ? "sudo " : "") + "apt";

                return 'you can run "' + aptCommand + " update && " + aptCommand + " install -y " + linuxPackages.apt.join(" ") + '"';
            }
        }

        if (linuxPackages.apk != null && linuxPackages.apk.length > 0) {
            const [
                sudoPath,
                apkPath
            ] = await Promise.all([
                which("sudo", {nothrow: true}),
                which("apk", {nothrow: true})
            ]);

            if (apkPath != null)
                return 'you can run "' + (sudoPath != null ? "sudo " : "") + "apk add " + linuxPackages.apk.join(" ") + '"';
        }

        return null;
    } else if (platform === "mac") {
        if (macOsPackages == null)
            return null;

        if (macOsPackages.brew != null && macOsPackages.brew.length > 0) {
            const brewPath = await which("brew", {nothrow: true});

            if (brewPath != null)
                return 'you can run "brew install ' + macOsPackages.brew.join(" ") + '"';
        }

        return null;
    }

    return null;
}
