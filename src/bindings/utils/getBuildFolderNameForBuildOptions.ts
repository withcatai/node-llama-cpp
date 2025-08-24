import {hashString} from "../../utils/hashString.js";
import {BuildOptions} from "../types.js";
import {builtinLlamaCppGitHubRepo, builtinLlamaCppRelease} from "../../config.js";

export async function getBuildFolderNameForBuildOptions(buildOptions: BuildOptions) {
    const nameParts: string[] = [buildOptions.platform, buildOptions.arch];
    const binParts: string[] = [];

    if (buildOptions.gpu !== false) {
        nameParts.push(makeStringSafeForPathName(buildOptions.gpu));
        binParts.push(makeStringSafeForPathName(buildOptions.gpu.toLowerCase()));
    }

    if (buildOptions.llamaCpp.repo !== builtinLlamaCppGitHubRepo || buildOptions.llamaCpp.release !== builtinLlamaCppRelease) {
        const releaseFolderNamePart = await getFolderNamePartForRelease(buildOptions.llamaCpp.repo, buildOptions.llamaCpp.release);
        nameParts.push("release-" + releaseFolderNamePart);
        binParts.push(releaseFolderNamePart.replaceAll(" ", "_"));
    } else if (buildOptions.llamaCpp.release !== "latest")
        binParts.push(buildOptions.llamaCpp.release);

    if (buildOptions.customCmakeOptions.size === 0) {
        const name = nameParts.join("-");
        return {
            withoutCustomCmakeOptions: name,
            withCustomCmakeOptions: name,
            binVariant: binParts.join(".")
        };
    }

    const cmakeOptionKeys = [...buildOptions.customCmakeOptions.keys()];
    cmakeOptionKeys.sort();

    const cmakeOptionStringsArray: string[] = [];
    for (const key of cmakeOptionKeys) {
        if (key === "")
            continue;

        cmakeOptionStringsArray.push(`${encodeURIComponent(key)}=${encodeURIComponent(buildOptions.customCmakeOptions.get(key)!)}`);
    }

    const nameWithoutCustomCmakeOptions = nameParts.join("-");
    if (cmakeOptionStringsArray.length === 0) {
        return {
            withoutCustomCmakeOptions: nameWithoutCustomCmakeOptions,
            withCustomCmakeOptions: nameWithoutCustomCmakeOptions,
            binVariant: binParts.join(".")
        };
    }

    const cmakeOptionsHash = await hashString(cmakeOptionStringsArray.join(";"));

    nameParts.push(cmakeOptionsHash);
    binParts.push(cmakeOptionsHash.slice(0, 8));
    const nameWithCustomCmakeOptions = nameParts.join("-");

    return {
        withoutCustomCmakeOptions: nameWithoutCustomCmakeOptions,
        withCustomCmakeOptions: nameWithCustomCmakeOptions,
        binVariant: binParts.join(".")
    };
}

async function getFolderNamePartForRelease(repo: string, release: string) {
    const resParts: string[] = [];
    let shouldHash = false;

    if (repo !== builtinLlamaCppGitHubRepo) {
        const [owner, name] = repo.split("/");

        if (containsUnsafeCharacters(String(owner)) || containsUnsafeCharacters(String(name))) {
            shouldHash = true;
            resParts.push(encodeURIComponent(String(owner)) + " " + encodeURIComponent(String(name)));
        } else
            resParts.push(String(owner) + " " + String(name));
    }

    if (containsUnsafeCharacters(release)) {
        shouldHash = true;
        resParts.push(encodeURIComponent(release));
    } else
        resParts.push(release);

    const res = resParts.join(" ");

    if (shouldHash)
        return await hashString(res);

    return res;
}

function makeStringSafeForPathName(str: string) {
    let res = "";

    for (const char of str) {
        if (isCharacterSafe(char))
            res += char;
        else
            res += "_" + char.codePointAt(0)!.toString(32) + "_";
    }

    return res;
}

function containsUnsafeCharacters(str: string) {
    for (const char of str) {
        if (!isCharacterSafe(char))
            return true;
    }

    return false;
}
function isCharacterSafe(char: string) {
    const unicodeNumber = char.codePointAt(0);

    if (unicodeNumber == null)
        return false;

    if (unicodeNumber >= "a".codePointAt(0)! && unicodeNumber <= "z".codePointAt(0)!)
        return true;
    else if (unicodeNumber >= "A".codePointAt(0)! && unicodeNumber <= "Z".codePointAt(0)!)
        return true;
    else if (unicodeNumber >= "0".codePointAt(0)! && unicodeNumber <= "9".codePointAt(0)!)
        return true;
    else if (char === "-" || char === "_" || char === ".")
        return true;

    return false;
}
