import fs from "fs-extra";
import {llamaBinsGrammarsDirectory, llamaCppGrammarsDirectory} from "../config.js";
import {getUsedBinFlag} from "./usedBinFlag.js";

export async function getGrammarsFolder() {
    const usedBinFlag = await getUsedBinFlag();

    if (usedBinFlag === "localBuildFromSource") {
        if (await fs.pathExists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    } else if (usedBinFlag === "prebuiltBinaries") {
        if (await fs.pathExists(llamaBinsGrammarsDirectory))
            return llamaBinsGrammarsDirectory;
        else if (await fs.pathExists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    }

    throw new Error("Grammars folder not found");
}
