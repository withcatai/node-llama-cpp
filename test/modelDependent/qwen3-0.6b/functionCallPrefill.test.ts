import {describe, expect, test} from "vitest";
import {
    type ChatHistoryItem, defineChatSessionFunction, getLlama, JinjaTemplateChatWrapper, LlamaChat, LlamaChatSession,
    QwenChatWrapper, resolveChatWrapper
} from "../../../dist/index.js";
import {getModelFile} from "../../utils/modelFiles.js";

const weatherSchema = {
    type: "object",
    properties: {
        city: {enum: ["San Francisco"]}
    }
} as const;

const history = (prefill: ChatHistoryItem & {type: "model"}): ChatHistoryItem[] => [{
    type: "user", text: "Use getWeather to check the weather."
}, prefill];

async function createContext() {
    const llama = await getLlama();
    const model = await llama.loadModel({modelPath: await getModelFile("Qwen3-0.6B-Q8_0.gguf")});
    return {llama, model, context: await model.createContext({contextSize: 1024})};
}

describe("function call prefill (Qwen3 0.6B)", () => {
    test("a supplied name forces argument generation without regenerating the name", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});

        const res = await chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: false}]
        }), {
            functions: {getWeather: {params: weatherSchema}}, maxParallelFunctionCalls: 1, temperature: 0, maxTokens: 100
        });

        expect(res.metadata.stopReason).toBe("functionCalls");
        expect(res.functionCalls?.map((call) => [call.functionName, call.params])).toEqual([
            ["getWeather", {city: "San Francisco"}]
        ]);
        expect(res.lastEvaluation.cleanHistory.at(-1)).toEqual({type: "model", response: []});
    });

    test("partially supplied arguments continue at the exact prefix", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});
        const chunks: string[] = [];

        const res = await chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: false, paramsText: '{"city":"San'}]
        }), {
            functions: {getWeather: {params: weatherSchema}}, maxParallelFunctionCalls: 1, temperature: 0, maxTokens: 100,
            onFunctionCallParamsChunk(chunk) {
                chunks.push(chunk.paramsChunk);
            }
        });

        expect(res.metadata.stopReason).toBe("functionCalls");
        expect(res.functionCalls?.[0]?.params).toEqual({city: "San Francisco"});
        expect(res.functionCalls?.[0]?.raw).toBeDefined();
        expect(chunks.join("")).not.toContain('{"city":"San'); // prefilled bytes must not be streamed again
    });

    test("a parameterless function prefill dispatches without generating arguments", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});

        const res = await chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getTime", ended: false}]
        }), {functions: {getTime: {}}, maxParallelFunctionCalls: 1, temperature: 0, maxTokens: 100});

        expect(res.metadata.stopReason).toBe("functionCalls");
        expect(res.functionCalls?.[0]).toMatchObject({functionName: "getTime", params: {}});
    });

    test("prefilled arguments are checked against the function schema", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});

        await expect(chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: true, params: {city: "Boston"}}]
        }), {functions: {getWeather: {params: weatherSchema}}})).rejects.toThrow(/Expected one of \["San Francisco"\]/);

        await expect(chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: false, paramsText: '{"city":"Boston'}]
        }), {functions: {getWeather: {params: weatherSchema}}})).rejects.toThrow(/violates its grammar/);
    });

    test("an unknown function name is rejected before generation", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});

        await expect(chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getForecast", ended: false}]
        }), {functions: {getWeather: {params: weatherSchema}}})).rejects.toThrow(/not in the supplied functions/);
    });

    test("arguments supplied to a parameterless function are rejected", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});

        await expect(chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getTime", ended: false, paramsText: "{}"}]
        }), {functions: {getTime: {}}})).rejects.toThrow(/does not accept parameters/);
    });

    test("a prefill cannot be combined with abortOnNonText", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});

        await expect(chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: false}]
        }), {
            functions: {getWeather: {params: weatherSchema}},
            abortOnNonText: true
        })).rejects.toThrow(/abortOnNonText/);
    });

    test("a prefill cannot be combined with a separate grammar", {timeout: 1000 * 60 * 10}, async () => {
        const {llama, context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});
        const grammar = await llama.createGrammar({grammar: 'root ::= "ok"'});

        await expect(chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: false}]
        }), {
            functions: {getWeather: {params: weatherSchema}},
            grammar
        })).rejects.toThrow(/not supported yet/);
    });

    test("an executed call can precede one unfinished call", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});
        const chunks: string[] = [];

        const res = await chat.generateResponse([{
            type: "user", text: "Use getWeather to check the weather."
        }, {
            type: "model",
            response: [{
                type: "functionCall", name: "getWeather", params: {city: "San Francisco"}, result: "sunny"
            }, {
                type: "functionCall", name: "getWeather", ended: false, paramsText: '{"city":"San'
            }]
        }], {
            functions: {getWeather: {params: weatherSchema}}, maxParallelFunctionCalls: 1, temperature: 0, maxTokens: 100,
            onFunctionCallParamsChunk(chunk) {
                chunks.push(chunk.paramsChunk);
            }
        });

        expect(res.metadata.stopReason).toBe("functionCalls");
        expect(res.functionCalls?.[0]?.params).toEqual({city: "San Francisco"});
        expect(chunks.join("")).not.toContain('{"city":"San');
    });

    test("a completed prefill dispatches without sampling or replaying history", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const sequence = context.getSequence();
        const chat = new LlamaChat({contextSequence: sequence, chatWrapper: new QwenChatWrapper()});
        const before = sequence.tokenMeter.usedOutputTokens;
        const seen: unknown[] = [];

        const res = await chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: true, params: {city: "San Francisco"}}]
        }), {
            functions: {getWeather: {params: weatherSchema}},
            onFunctionCall(call) {
                seen.push(call.params);
            }
        });

        expect(sequence.tokenMeter.usedOutputTokens).toBe(before);
        expect(seen).toEqual([{city: "San Francisco"}]);
        expect(res.functionCalls).toHaveLength(1);
        expect(res.lastEvaluation.cleanHistory.at(-1)).toEqual({type: "model", response: []});
    });

    test("an interrupted call returns a resumable argument prefix", {timeout: 1000 * 60 * 10}, async () => {
        const {context} = await createContext();
        const chat = new LlamaChat({contextSequence: context.getSequence(), chatWrapper: new QwenChatWrapper()});
        const interrupted = await chat.generateResponse(history({
            type: "model", response: [{type: "functionCall", name: "getWeather", ended: false}]
        }), {functions: {getWeather: {params: weatherSchema}}, maxTokens: 1});

        expect(interrupted.metadata.stopReason).toBe("maxTokens");
        const last = interrupted.lastEvaluation.cleanHistory.at(-1);
        expect(last?.type).toBe("model");
        if (last?.type !== "model")
            throw new Error("Expected a model response");
        expect(last.response.at(-1)).toMatchObject({type: "functionCall", name: "getWeather", ended: false});

        const resumed = await chat.generateResponse(interrupted.lastEvaluation.cleanHistory, {
            functions: {getWeather: {params: weatherSchema}}, maxParallelFunctionCalls: 1, temperature: 0, maxTokens: 100
        });
        expect(resumed.metadata.stopReason).toBe("functionCalls");
        expect(resumed.functionCalls?.[0]?.params).toEqual({city: "San Francisco"});
    });

    test.each(["native", "jinja"])("the session dispatches a ready call once (%s)",
        {timeout: 1000 * 60 * 10}, async (format) => {
            const {model, context} = await createContext();
            const session = new LlamaChatSession({
                contextSequence: context.getSequence(),
                chatWrapper: format === "native"
                    ? new QwenChatWrapper()
                    : resolveChatWrapper(model, {type: "jinjaTemplate"})
            });
            if (format === "jinja")
                expect(session.chatWrapper).toBeInstanceOf(JinjaTemplateChatWrapper);

            let calls = 0;
            session.setChatHistory(history({
                type: "model", response: [{type: "functionCall", name: "getWeather", ended: true, params: {city: "San Francisco"}}]
            }));
            await session.continueResponseWithMeta({
                functions: {
                    getWeather: defineChatSessionFunction({
                        params: weatherSchema,
                        handler(params) {
                            calls++;
                            return `Weather in ${params.city}`;
                        }
                    })
                },
                maxTokens: 32
            });

            expect(calls).toBe(1);
            const responses = session.getChatHistory()
                .filter((item) => item.type === "model")
                .flatMap((item) => item.response)
                .filter((item) => typeof item !== "string" && item.type === "functionCall");
            expect(responses).toHaveLength(1);
            expect(responses[0]).toMatchObject({name: "getWeather", result: "Weather in San Francisco"});
        });
});
