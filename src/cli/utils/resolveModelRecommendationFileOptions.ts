import {normalizeGgufDownloadUrl} from "../../gguf/utils/normalizeGgufDownloadUrl.js";

export type ModelRecommendation = {
    name: string,
    abilities: ("chat" | "complete" | "infill" | "functionCalling")[],
    description?: string,

    /**
     * Files ordered by quality.
     * The first file that has 100% compatibility with the current system
     * will be used (and the rest of the files won't even be tested),
     * otherwise, the file with the highest compatibility will be used.
     */
    fileOptions: Array<{
        huggingFace: {
            model: `${string}/${string}`,
            branch: string,
            file: `${string}.gguf` | `${string}.gguf.part${number}of${number}`
        }
    }>
};

export function resolveModelRecommendationFileOptions(modelRecommendation: ModelRecommendation) {
    return modelRecommendation.fileOptions.map((fileOption) => {
        return normalizeGgufDownloadUrl(
            `https://huggingface.co/${fileOption.huggingFace.model}/resolve/${fileOption.huggingFace.branch}/${fileOption.huggingFace.file}`
        );
    });
}
