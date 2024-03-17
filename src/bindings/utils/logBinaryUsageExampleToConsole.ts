import {BuildOptions} from "../types.js";
import {removeUndefinedFields} from "../../utils/removeNullFields.js";
import {LlamaOptions} from "../getLlama.js";
import {getExampleUsageCodeOfGetLlama} from "./getExampleUsageCodeOfGetLlama.js";

export function logBinaryUsageExampleToConsole(
    buildOptions: BuildOptions, specifyGpuType: boolean, showLatestBuildUsageExample: boolean = true
) {
    console.log("To use the binary you've just built, use this code:");
    const llamaOptions: LlamaOptions = removeUndefinedFields({
        gpu: specifyGpuType
            ? buildOptions.gpu
            : undefined,
        cmakeOptions: buildOptions.customCmakeOptions.size === 0
            ? undefined
            : Object.fromEntries(
                [...buildOptions.customCmakeOptions.entries()].sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            )
    });
    console.log(
        getExampleUsageCodeOfGetLlama(
            Object.keys(llamaOptions).length === 0
                ? undefined
                : llamaOptions
        )
    );

    if (showLatestBuildUsageExample) {
        console.log();
        console.log("To always use the latest binary you build using a CLI command, use this code:");
        console.log(getExampleUsageCodeOfGetLlama("lastBuild"));
    }
}
