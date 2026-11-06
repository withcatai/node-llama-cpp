import {describe, expect, test} from "vitest";
import {GeneralChatWrapper} from "../../../src/chatWrappers/GeneralChatWrapper.js";
import {
    eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy
} from "../../../src/evaluator/LlamaChat/utils/contextShiftStrategies/eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy.js";
import {ChatHistoryItem, Tokenizer} from "../../../src/types.js";


// a fake tokenizer that counts roughly one token per word, so the test doesn't need a model
const tokenizer = ((text: string) => {
    return Array.from(text.matchAll(/\S+\s*/g)).map((_match, index) => index + 1);
}) as unknown as Tokenizer;
(tokenizer as unknown as {detokenize: () => string}).detokenize = () => "";

const words = (count: number, prefix: string) => Array.from({length: count}, (_, i) => prefix + i).join(" ");

describe("eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy", () => {
    test("does not drop a user message that was meant to be kept entirely", async () => {
        const firstUserMessage = words(60, "ua");
        const chatHistory: ChatHistoryItem[] = [
            {type: "system", text: "You are a helpful assistant."},
            {type: "user", text: firstUserMessage},
            {type: "user", text: words(60, "ub")},
            {type: "user", text: words(60, "uc")},
            {type: "model", response: [words(300, "mc")]}
        ];

        const res = await eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy({
            chatHistory,
            maxTokensCount: 400,
            tokenizer,
            chatWrapper: new GeneralChatWrapper()
        });

        const userMessages = res.chatHistory.filter((item) => item.type === "user");
        expect(res.chatHistory[0]).to.eql(chatHistory[0]);
        expect(userMessages.length).toBeGreaterThanOrEqual(2);
        expect(userMessages[0]).to.eql({type: "user", text: firstUserMessage});
    });
});
