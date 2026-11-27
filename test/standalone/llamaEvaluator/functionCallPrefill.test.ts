import {describe, expect, test} from "vitest";
import {
    ChatHistoryItem, ChatModelFunctionCall, GeneralChatWrapper, Gemma4ChatWrapper, HarmonyChatWrapper, MuseChatWrapper
} from "../../../src/index.js";
import {
    addResolvedFunctionCallBeforePrefill, getFunctionCallPrefill, withoutFunctionCallPrefill
} from "../../../src/utils/getFunctionCallPrefill.js";
import {fromChatHistoryToIntermediateOpenAiMessages} from "../../../src/utils/OpenAIFormat.js";

const nameOnly = {type: "functionCall", name: "getWeather", ended: false} as const;
const partial = {type: "functionCall", name: "getWeather", ended: false, paramsText: '{"city":"San'} as const;
const ready = {type: "functionCall", name: "getWeather", ended: true, params: {city: "San Francisco"}} as const;
const resolved = {type: "functionCall", name: "getWeather", params: {city: "San Francisco"}, result: undefined} as const;

const asHistory = (call: ChatModelFunctionCall): ChatHistoryItem[] => [{
    type: "user", text: "Weather?"
}, {
    type: "model", response: ["Checking: ", call]
}];

describe("function call prefills", () => {
    test("distinguishes a pending call from an executed call with an undefined result", () => {
        expect(getFunctionCallPrefill(asHistory(nameOnly))).toEqual(nameOnly);
        expect(getFunctionCallPrefill(asHistory(partial))).toEqual(partial);
        expect(getFunctionCallPrefill(asHistory(ready))).toEqual(ready);
        expect(getFunctionCallPrefill(asHistory(resolved))).toBeUndefined();
    });

    test("removes only the pending call without mutating the caller's history", () => {
        const history = asHistory(partial);
        const cleanHistory = withoutFunctionCallPrefill(history);

        expect((cleanHistory[1] as {response: unknown[]}).response).toEqual(["Checking: "]);
        expect((history[1] as {response: unknown[]}).response).toEqual(["Checking: ", partial]);
        expect(withoutFunctionCallPrefill(asHistory(resolved))).toEqual(asHistory(resolved));
    });

    test("does not allow prefills to become historical calls", () => {
        expect(() => getFunctionCallPrefill([...asHistory(partial), {type: "user", text: "Next"}])).toThrow(/last model response/);
        expect(() => getFunctionCallPrefill([{
            type: "model", response: [partial, "Trailing text"]
        }])).toThrow(/last model response/);
        expect(() => getFunctionCallPrefill([{
            type: "model", response: [ready, ready]
        }])).toThrow(/last model response/);
        expect(() => getFunctionCallPrefill([{
            type: "model", response: [ready, partial]
        }])).toThrow(/last model response/);
    });

    test("accepts one executed call before a single unfinished call", () => {
        const history: ChatHistoryItem[] = [{
            type: "model", response: [resolved, partial]
        }];

        expect(getFunctionCallPrefill(history)).toEqual(partial);
    });

    test("inserts a resolved parallel call before the unfinished call", () => {
        const response: ChatModelFunctionCall[] = [partial];
        addResolvedFunctionCallBeforePrefill(response, resolved);
        expect(response).toEqual([resolved, partial]);
    });

    test("ordinary and specialized wrappers do not serialize a result for pending calls", () => {
        for (const wrapper of [
            new GeneralChatWrapper(), new Gemma4ChatWrapper(), new HarmonyChatWrapper(), new MuseChatWrapper()
        ]) {
            const prefix = wrapper.generateModelResponseText([partial]).toString();
            const completed = wrapper.generateModelResponseText([ready]).toString();
            const historical = wrapper.generateModelResponseText([resolved]).toString();

            expect(prefix).toContain('{"city":"San');
            expect(prefix).not.toContain("San Francisco");
            expect(completed).toContain("San Francisco");
            expect(historical).toContain("San Francisco");
            expect(prefix.length).toBeLessThan(historical.length);
        }
    });

    test("OpenAI intermediate messages omit tool results for unexecuted calls", () => {
        const chatWrapperSettings = new GeneralChatWrapper().settings;
        for (const call of [nameOnly, partial, ready]) {
            const {messages} = fromChatHistoryToIntermediateOpenAiMessages({
                chatHistory: asHistory(call), chatWrapperSettings
            });
            expect(messages.filter((item) => item.role === "tool")).toHaveLength(0);
            expect(messages.some((item) => item.role === "assistant" && item.tool_calls?.length === 1)).toBe(true);
        }

        const {messages} = fromChatHistoryToIntermediateOpenAiMessages({
            chatHistory: asHistory(resolved), chatWrapperSettings
        });
        expect(messages.filter((item) => item.role === "tool")).toHaveLength(1);
    });

    test("base function-call formatting omits closing delimiters for unfinished calls", () => {
        const wrapper = new GeneralChatWrapper();
        const unstarted = wrapper.generateFunctionCallsAndResults([nameOnly]).toString();
        const incomplete = wrapper.generateFunctionCallsAndResults([partial]).toString();
        const complete = wrapper.generateFunctionCallsAndResults([ready]).toString();
        const executed = wrapper.generateFunctionCallsAndResults([resolved]).toString();

        expect(unstarted).toContain("getWeather(");
        expect(unstarted).not.toContain("||result:");
        expect(incomplete.endsWith('{"city":"San')).toBe(true);
        expect(complete.endsWith(")")).toBe(true);
        expect(complete).not.toContain("||result:");
        expect(executed).toContain("||result:");
    });

    test("a wrapper without parallel calls renders an executed call and then the unfinished prefix", () => {
        const wrapper = new GeneralChatWrapper();
        const text = wrapper.generateModelResponseText([resolved, partial]).toString();
        const resultAt = text.indexOf("||result:");
        const prefixAt = text.lastIndexOf('{"city":"San');

        expect(wrapper.settings.functions.parallelism).toBeUndefined();
        expect(resultAt).toBeGreaterThanOrEqual(0);
        expect(prefixAt).toBeGreaterThan(resultAt);
        expect(text.endsWith('{"city":"San')).toBe(true);
        expect(text.slice(prefixAt)).not.toContain(")");
    });
});
