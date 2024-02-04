import fs from "fs-extra";
import {lastBuildInfoJsonPath} from "../../config.js";

type LastBuildInfo = {
    folderName: string
};

export async function getLastBuildInfo() {
    try {
        const buildInfo: LastBuildInfo = await fs.readJson(lastBuildInfoJsonPath);

        return buildInfo;
    } catch (err) {
        return null;
    }
}

export async function setLastBuildInfo(buildInfo: LastBuildInfo) {
    await fs.writeJson(lastBuildInfoJsonPath, buildInfo, {
        spaces: 4
    });
}
