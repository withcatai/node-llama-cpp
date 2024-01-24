import {ChatHistoryItem, ChatUserMessage} from "../types.js";

export function appendUserMessageToChatHistory(chatHistory: readonly ChatHistoryItem[], message: string) {
    const newChatHistory = chatHistory.slice();

    if (newChatHistory.length > 0 && newChatHistory[newChatHistory.length - 1].type === "user") {
        const lastUserMessage = newChatHistory[newChatHistory.length - 1] as ChatUserMessage;

        newChatHistory[newChatHistory.length - 1] = {
            ...lastUserMessage,
            text: [lastUserMessage.text, message].join("\n\n")
        };
    } else {
        newChatHistory.push({
            type: "user",
            text: message
        });
    }

    return newChatHistory;
}
