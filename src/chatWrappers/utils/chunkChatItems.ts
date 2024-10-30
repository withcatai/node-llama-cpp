import {ChatHistoryItem, ChatModelResponse} from "../../types.js";
import {LlamaText} from "../../utils/LlamaText.js";

export function chunkChatItems(chatHistory: readonly ChatHistoryItem[], {
    generateModelResponseText,
    joinAdjacentMessagesOfTheSameType = true
}: {
    generateModelResponseText: (modelResponse: ChatModelResponse["response"]) => LlamaText,
    joinAdjacentMessagesOfTheSameType?: boolean
}) {
    const resultItems: Array<{
        system: LlamaText,
        user: LlamaText,
        model: LlamaText
    }> = [];

    let systemTexts: LlamaText[] = [];
    let userTexts: LlamaText[] = [];
    let modelTexts: LlamaText[] = [];
    let currentAggregateFocus: "system" | "user" | "model" | null = null;

    function flush() {
        if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0)
            resultItems.push({
                system: LlamaText.joinValues("\n\n", systemTexts),
                user: LlamaText.joinValues("\n\n", userTexts),
                model: LlamaText.joinValues("\n\n", modelTexts)
            });

        systemTexts = [];
        userTexts = [];
        modelTexts = [];
    }

    for (const item of chatHistory) {
        if (item.type === "system") {
            if (!joinAdjacentMessagesOfTheSameType || currentAggregateFocus !== "system")
                flush();

            currentAggregateFocus = "system";
            systemTexts.push(LlamaText.fromJSON(item.text));
        } else if (item.type === "user") {
            if (!joinAdjacentMessagesOfTheSameType || (currentAggregateFocus !== "system" && currentAggregateFocus !== "user"))
                flush();

            currentAggregateFocus = "user";
            userTexts.push(LlamaText(item.text));
        } else if (item.type === "model") {
            if (!joinAdjacentMessagesOfTheSameType)
                flush();

            currentAggregateFocus = "model";
            modelTexts.push(generateModelResponseText(item.response));
        } else
            void (item satisfies never);
    }

    flush();

    return resultItems;
}
