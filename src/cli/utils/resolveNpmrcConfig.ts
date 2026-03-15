import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import {getPlatform} from "../../bindings/utils/getPlatform.js";

const defaultNpmRegistry = "https://registry.npmjs.org/";

export async function getCurrentNpmrcConfig() {
    const layers = await getNpmConfigLayers(process.cwd());

    const mergedConfig: Record<string, string> = {
        ...layers.builtin,
        ...layers.global,
        ...layers.user,
        ...layers.project,
        ...layers.env
    };

    return mergedConfig;
}

export function getNpmrcRegistry(npmrcConfig: Record<string, string>) {
    const registryUrl = npmrcConfig.registry ?? defaultNpmRegistry;
    let cleanRegistryUrl: string = registryUrl;

    try {
        const url = new URL(registryUrl);
        url.search = "";
        url.hash = "";
        cleanRegistryUrl = url.href;
    } catch (err) {
        // do nothing
    }

    if (!cleanRegistryUrl.endsWith("/"))
        cleanRegistryUrl += "/";

    return {
        isDefault: cleanRegistryUrl === defaultNpmRegistry,
        registryUrl,
        cleanRegistryUrl: cleanRegistryUrl
    };
}

async function findNearestProjectNpmrc(startDir: string): Promise<string | undefined> {
    let currentDirPath = path.resolve(startDir);

    while (true) {
        const npmrcPath = path.join(currentDirPath, ".npmrc");
        if (await fs.pathExists(npmrcPath))
            return npmrcPath;

        const parentDirPath = path.dirname(currentDirPath);
        if (parentDirPath === currentDirPath)
            return undefined;

        currentDirPath = parentDirPath;
    }
}

function parseNpmrc(content: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
    const result: Record<string, string> = {};

    for (const rawLine of content.split(/\r?\n/u)) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith(";") || line.startsWith("#"))
            continue;

        const eqIndex = line.indexOf("=");
        if (eqIndex <= 0)
            continue;

        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1)
            .trim()
            .replace(/\$\{([^}]+)\}/gu, (match: string, envVarName: string) => (env[envVarName] ?? ""));

        result[key] = value;
    }

    return result;
}

async function readNpmrc(filePath: string | undefined): Promise<Record<string, string>> {
    if (filePath == null || !(await fs.pathExists(filePath)))
        return {};

    return parseNpmrc(fs.readFileSync(filePath, "utf8"));
}

async function getDefaultGlobalConfigPath(npmPrefixConfig?: string): Promise<string | undefined> {
    const prefix = npmPrefixConfig ?? process.env.PREFIX;

    if (prefix != null && prefix !== "")
        return path.join(prefix, "etc", "npmrc");

    const platform = getPlatform();
    if (platform === "win") {
        const appData = process.env.APPDATA;
        if (appData != null && appData !== "")
            return path.join(appData, "npm", "etc", "npmrc");
    } else if (platform === "mac") {
        const npmrcLocations = [
            "/opt/homebrew/etc/npmrc",
            "/usr/local/etc/npmrc"
        ];

        for (const candidate of npmrcLocations) {
            if (await fs.pathExists(candidate))
                return candidate;
        }
    } else if (platform === "linux")
        return "/etc/npmrc";

    return undefined;
}

async function getNpmConfigLayers(startDir: string): Promise<NpmConfigLayers> {
    const envConfig: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (value == null)
            continue;

        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith("npm_config_")) {
            const configKey = lowerKey.slice("npm_config_".length).replaceAll("_", "-");
            envConfig[configKey] = value;
        }
    }

    const globalConfigPath = envConfig["globalconfig"] ?? await getDefaultGlobalConfigPath(envConfig["prefix"]);
    const userConfigPath = envConfig["userconfig"] ?? path.join(os.homedir(), ".npmrc");
    const projectConfigPath = await findNearestProjectNpmrc(startDir);

    const [
        globalConfig,
        userConfig,
        projectConfig
    ] = await Promise.all([
        await readNpmrc(globalConfigPath),
        await readNpmrc(userConfigPath),
        await readNpmrc(projectConfigPath)
    ]);

    return {
        builtin: {
            registry: defaultNpmRegistry
        },
        global: globalConfig,
        user: userConfig,
        project: projectConfig,
        env: envConfig,
        paths: {
            project: projectConfigPath,
            user: userConfigPath,
            global: globalConfigPath
        }
    };
}

export type NpmConfigLayers = {
    builtin: Record<string, string>,
    global: Record<string, string>,
    user: Record<string, string>,
    project: Record<string, string>,
    env: Record<string, string>,
    paths: {
        project: string | undefined,
        user: string | undefined,
        global: string | undefined
    }
};
