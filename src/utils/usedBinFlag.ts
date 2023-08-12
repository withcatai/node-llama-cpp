import fs from "fs-extra";
import {usedBinFlagJsonPath} from "../config.js";

type UsedBinFlagFile = {
    use: "prebuiltBinaries" | "localBuildFromSource"
};

export async function getUsedBinFlag() {
    const usedBinFlagJson: UsedBinFlagFile = await fs.readJson(usedBinFlagJsonPath);

    return usedBinFlagJson.use;
}

export async function setUsedBinFlag(useFlag: UsedBinFlagFile["use"]) {
    const usedBinFlagJson: UsedBinFlagFile = {
        use: useFlag
    };

    await fs.writeJson(usedBinFlagJsonPath, usedBinFlagJson, {
        spaces: 4
    });
}
