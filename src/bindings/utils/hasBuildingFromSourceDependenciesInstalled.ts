import which from "which";
import {asyncEvery} from "./asyncEvery.js";

export async function hasBuildingFromSourceDependenciesInstalled() {
    return await asyncEvery([
        hasGit(),
        hasNpm()
    ]);
}

export async function hasGit() {
    try {
        const resolvedPath = await which("git");
        return resolvedPath !== "";
    } catch (err) {
        return false;
    }
}

export async function hasNpm() {
    try {
        const resolvedPath = await which("npm");
        return resolvedPath !== "";
    } catch (err) {
        return false;
    }
}
