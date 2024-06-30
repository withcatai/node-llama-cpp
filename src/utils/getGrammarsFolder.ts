import fs from "fs-extra";
import {llamaBinsGrammarsDirectory, llamaCppGrammarsDirectory} from "../config.js";
import {Llama} from "../bindings/Llama.js";
import {isLlamaCppRepoCloned} from "../bindings/utils/cloneLlamaCppRepo.js";

export async function getGrammarsFolder(buildType: Llama["buildType"]) {
    if (buildType === "localBuild") {
        if (await isLlamaCppRepoCloned(true) && await fs.pathExists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    } else if (buildType === "prebuilt") {
        if (await fs.pathExists(llamaBinsGrammarsDirectory))
            return llamaBinsGrammarsDirectory;
        else if (await isLlamaCppRepoCloned(false) && await fs.pathExists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    } else
        void (buildType satisfies never);

    throw new Error("Grammars folder not found");
}
