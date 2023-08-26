import fs from "fs-extra";
import {llamaBinsGrammarsDirectory, llamaCppGrammarsDirectory} from "../config.js";
import {getUsedBinFlag} from "./usedBinFlag.js";

export async function getGrammarsFolder() {
    const usedBingFlag = await getUsedBinFlag();

    if (usedBingFlag === "localBuildFromSource") {
        if (await fs.exists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    } else if (usedBingFlag === "prebuiltBinaries") {
        if (await fs.exists(llamaBinsGrammarsDirectory))
            return llamaBinsGrammarsDirectory;
        else if (await fs.exists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    }

    throw new Error("Grammars folder not found");
}
