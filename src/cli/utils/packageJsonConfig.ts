import path from "path";
import fs from "fs-extra";
import {NodeLlamaCppPostinstallBehavior} from "../../types.js";

export async function resolvePackageJsonConfig(startDir: string) {
    const currentConfig: Record<string, any> = {};

    let currentDirPath = path.resolve(startDir);
    while (true) {
        applyConfig(currentConfig, await readPackageJsonConfig(path.join(currentDirPath, "package.json")));

        const parentDirPath = path.dirname(currentDirPath);
        if (parentDirPath === currentDirPath)
            break;

        currentDirPath = parentDirPath;
    }

    const npmPackageJsonPath = process.env["npm_package_json"] ?? "";
    if (npmPackageJsonPath !== "")
        applyConfig(currentConfig, await readPackageJsonConfig(npmPackageJsonPath));

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

async function readPackageJsonConfig(packageJsonPath: string) {
    try {
        if (!(await fs.pathExists(packageJsonPath)))
            return {};

        const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
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
    for (const key of Object.keys(newConfig)) {
        if (Object.hasOwn(baseConfig, key))
            continue;

        baseConfig[key] = newConfig[key];
    }
}
