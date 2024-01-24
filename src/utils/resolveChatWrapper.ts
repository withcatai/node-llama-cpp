import {ChatWrapper} from "../ChatWrapper.js";
import {resolveChatWrapperBasedOnModel} from "../chatWrappers/resolveChatWrapperBasedOnModel.js";
import {GeneralChatWrapper} from "../chatWrappers/GeneralChatWrapper.js";
import {LlamaModel} from "../llamaEvaluator/LlamaModel.js";

export function resolveChatWrapper(chatWrapper: "auto" | ChatWrapper, model: LlamaModel) {
    if (chatWrapper === "auto") {
        const chatWrapper = resolveChatWrapperBasedOnModel({
            bosString: model.tokens.bosString,
            filename: model.filename,
            typeDescription: model.typeDescription
        });

        if (chatWrapper != null)
            return new chatWrapper();

        return new GeneralChatWrapper();
    }

    return chatWrapper;
}
