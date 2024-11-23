import {ChatWrapperCheckModelCompatibilityParams} from "../../types.js";
import {includesText} from "../../utils/includesText.js";
import {getModelLinageNames} from "./getModelLinageNames.js";

export function isLlama3_2LightweightModel(options: ChatWrapperCheckModelCompatibilityParams) {
    const isLlama3_2 = getModelLinageNames(options.fileInfo?.metadata)
        .some((modelNames) => includesText(modelNames, ["llama 3.2", "llama-3.2", "llama3.2"]));
    const isSmallModel = (["1B", "3B"] as string[]).includes(options.fileInfo?.metadata?.general?.size_label ?? "");

    return isLlama3_2 && isSmallModel;
}
