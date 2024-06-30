import {describe, expect, test} from "vitest";
import {Llama3ChatWrapper, LlamaChatSession, Token} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {pushAll} from "../../../src/utils/pushAll.js";

describe("llama 3", () => {
    describe("chat session", () => {
        test("stop on abort signal", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 2048
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(Llama3ChatWrapper);

            const tokens: Token[] = [];
            const abortController = new AbortController();
            const res = await chatSession.prompt("Describe the appearance of a llama in extensive detail", {
                signal: abortController.signal,
                stopOnAbortSignal: true,
                onToken(chunk) {
                    pushAll(tokens, chunk);

                    if (tokens.length >= 2)
                        abortController.abort();
                }
            });

            expect(res.length).to.be.greaterThanOrEqual(1);
        });

        test("custom stop trigger", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 2048
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(Llama3ChatWrapper);

            const res = await chatSession.promptWithMeta("Describe the appearance of a llama", {
                customStopTriggers: ["llama"]
            });

            expect(res.stopReason).to.eql("customStopTrigger");
            expect(res.customStopTrigger).to.eql(["llama"]);
            expect(res.responseText.length).to.be.greaterThanOrEqual(1);
            expect(res.responseText.toLowerCase()).to.not.include("llama");
        });

        test("preloading a prompt works", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 2048
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(Llama3ChatWrapper);

            const prompt = "Describe the appearance of a llama";
            await chatSession.preloadPrompt(prompt);
            expect(model.detokenize(chatSession.sequence.contextTokens).endsWith(prompt)).to.eql(true);
        });

        test("completing a prompt works", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 2048
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(Llama3ChatWrapper);

            const prompt = "Describe the appearance of a llama and explain what";
            const completion = await chatSession.completePrompt(prompt, {
                maxTokens: 40
            });
            expect(completion).to.eql(" it is.");
        });

        // disabled due to getting timeout in the CI due to taking too long
        test.skip("context shift works correctly", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const contextSize = 2048;

            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence(),
                systemPrompt: "You are a helpful, respectful and honest biologist. " +
                    "Always answer as helpfully as possible with extensive detail."
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(Llama3ChatWrapper);

            const shouldBeOk = await chatSession.prompt(
                "Remember this fact: Platypuses have venomous spurs on their hind legs. Answer with 'OK' to confirm you understand and remember this fact.",
                {maxTokens: contextSize}
            );
            expect(shouldBeOk.slice(0, "OK".length)).to.eql("OK");

            await chatSession.prompt(
                "Create a concept for a new animal." +
                "Provide a realistic outline of this animal, including its social structures, appearance, habitat, origins and diet.",
                {maxTokens: contextSize}
            );

            await chatSession.prompt("Elaborate on its social structures", {maxTokens: contextSize});
            await chatSession.prompt("Elaborate on its appearance", {maxTokens: contextSize});
            await chatSession.prompt("Elaborate on its habitat", {maxTokens: contextSize});
            await chatSession.prompt("Elaborate on its diet", {maxTokens: contextSize});
            await chatSession.prompt("Elaborate on its origins", {maxTokens: contextSize});

            await chatSession.prompt("What was the animal fact I asked you to remember earlier?", {maxTokens: contextSize});

            const res = await chatSession.prompt("How much is 6+6", {maxTokens: 50});
            expect(res).to.include("12");
        });
    });
});
