import path from "path";
import fs from "fs-extra";
import {NodeLlamaCppPostinstallBehavior} from "../../types.js";

export async function resolvePackageJsonConfig(startDir: string) {
    const currentConfig: Record<string, any> = {};

    let currentDirPath = path.resolve(startDir);
    while (true) {
        const packageJsonPath = path.join(currentDirPath, "package.json");
        try {
            if (await fs.pathExists(packageJsonPath))
                applyConfig(currentConfig, await readPackageJsonConfig(packageJsonPath));
        } catch (err) {
            // do nothing
        }

        const parentDirPath = path.dirname(currentDirPath);
        if (parentDirPath === currentDirPath)
            break;

        currentDirPath = parentDirPath;
    }

    return currentConfig;
}

export function parsePackageJsonConfig(config: Record<string, any>) {
    const res: NlcPackageJsonConfig = {};

    const castedConfig = config as NlcPackageJsonConfig;

    if (castedConfig.nodeLlamaCppPostinstall === "auto" ||
        castedConfig.nodeLlamaCppPostinstall === "ignoreFailedBuild" ||
        castedConfig.nodeLlamaCppPostinstall === "skip"
    )
        res.nodeLlamaCppPostinstall = castedConfig.nodeLlamaCppPostinstall;
    else
        void (castedConfig.nodeLlamaCppPostinstall satisfies undefined);

    return res;
}

export type NlcPackageJsonConfig = {
    nodeLlamaCppPostinstall?: NodeLlamaCppPostinstallBehavior
};

function readPackageJsonConfig(packageJsonPath: string) {
    try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        const config = packageJson?.config;
        if (typeof config === "object")
            return config;

        return {};
    } catch (err) {
        return {};
    }
}

function applyConfig(baseConfig: Record<string, any>, newConfig: Record<string, any>) {
    for (const key in newConfig) {
        if (key in baseConfig)
            continue;

        baseConfig[key] = newConfig[key];
    }
}
