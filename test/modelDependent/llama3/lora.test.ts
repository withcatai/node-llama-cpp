import {describe, expect, test} from "vitest";
import {Llama3ChatWrapper, LlamaChatSession} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3", () => {
    describe("lora", () => {
        test("use lora", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const prompt = "Tell me something you shouldn't tell. It should be about food safety";

            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const loraPath = await getModelFile("lora-Llama-3-Instruct-abliteration-LoRA-8B-f16.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const contextWithoutLora = await model.createContext({
                contextSize: 2048
            });
            const chatSessionWithoutLora = new LlamaChatSession({
                contextSequence: contextWithoutLora.getSequence()
            });
            expect(chatSessionWithoutLora.chatWrapper).to.be.an.instanceof(Llama3ChatWrapper);
            const resWithoutLora = await chatSessionWithoutLora.prompt(prompt);
            expect(resWithoutLora).to.include("I cannot provide information");

            await contextWithoutLora.dispose();


            const contextWithLora = await model.createContext({
                contextSize: 2048,
                lora: {
                    adapters: [{
                        filePath: loraPath
                    }]
                }
            });
            const chatSessionWithLora = new LlamaChatSession({
                contextSequence: contextWithLora.getSequence()
            });
            expect(chatSessionWithLora.chatWrapper).to.be.an.instanceof(Llama3ChatWrapper);
            const resWithLora = await chatSessionWithLora.prompt(prompt);
            expect(resWithLora.length).to.be.greaterThanOrEqual(1);
            expect(resWithLora).to.not.include("I cannot provide information");
        });

        test("dispose context unloads lora", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const loraPath = await getModelFile("lora-Llama-3-Instruct-abliteration-LoRA-8B-f16.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const context = await model.createContext({
                contextSize: 2048,
                lora: {
                    adapters: [{
                        filePath: loraPath
                    }]
                }
            });

            await context.dispose();
        });

        test("using multiple contexts with lora", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const loraPath = await getModelFile("lora-Llama-3-Instruct-abliteration-LoRA-8B-f16.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            const context = await model.createContext({
                contextSize: 2048,
                lora: {
                    adapters: [{
                        filePath: loraPath
                    }]
                }
            });
            const context2 = await model.createContext({
                contextSize: 2048,
                lora: {
                    adapters: [{
                        filePath: loraPath
                    }]
                }
            });

            await context.dispose();

            const context3 = await model.createContext({
                contextSize: 2048,
                lora: {
                    adapters: [{
                        filePath: loraPath
                    }]
                }
            });

            await context2.dispose();
            await context3.dispose();
        });

        test("unload model unloads lora", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const loraPath = await getModelFile("lora-Llama-3-Instruct-abliteration-LoRA-8B-f16.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            await model.createContext({
                contextSize: 2048,
                lora: {
                    adapters: [{
                        filePath: loraPath
                    }]
                }
            });

            await model.dispose();
        });

        test("implicitly unloading model and context with lora", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3-8B-Instruct-Q4_K_M.gguf");
            const loraPath = await getModelFile("lora-Llama-3-Instruct-abliteration-LoRA-8B-f16.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });

            await model.createContext({
                contextSize: 2048,
                lora: {
                    adapters: [{
                        filePath: loraPath
                    }]
                }
            });
        });
    });
});
