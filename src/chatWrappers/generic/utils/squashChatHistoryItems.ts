import {ChatHistoryItem} from "../../../types.js";
import {LlamaText} from "../../../utils/LlamaText.js";

export function squashChatHistoryItems(history: readonly ChatHistoryItem[]) {
    const res: ChatHistoryItem[] = [];
    for (const item of history) {
        const lastItem = res.at(-1);
        if (lastItem == null) {
            res.push(structuredClone(item));
            continue;
        }

        if (lastItem.type === "system" && item.type === "system")
            lastItem.text = LlamaText.joinValues("\n\n", [
                LlamaText.fromJSON(lastItem.text),
                LlamaText.fromJSON(item.text)
            ]).toJSON();
        else if (lastItem.type === "user" && item.type === "user")
            lastItem.text += "\n\n" + item.text;
        else if (lastItem.type === "model" && item.type === "model") {
            const responsesToAdd = ["\n\n", ...item.response];

            while (typeof responsesToAdd[0] === "string" && typeof lastItem.response.at(-1) === "string") {
                const lastResponses = lastItem.response.pop()!;
                if (typeof lastResponses !== "string") {
                    lastItem.response.push(lastResponses);
                    break;
                }

                lastItem.response.push(lastResponses + responsesToAdd.shift()!);
            }

            while (responsesToAdd.length > 0)
                lastItem.response.push(responsesToAdd.shift()!);
        } else
            res.push(structuredClone(item));
    }

    return res;
}
