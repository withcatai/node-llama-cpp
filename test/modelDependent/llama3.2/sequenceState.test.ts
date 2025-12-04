import {describe, expect, test} from "vitest";
import fs from "fs-extra";
import {LlamaChatSession, TokenMeter} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {getTempTestFilePath} from "../../utils/helpers/getTempTestDir.js";
import {toBytes} from "../../../src/cli/utils/toBytes.js";

describe("llama 3.2", () => {
    describe("chatSession", () => {
        describe("sequence state", () => {
            test("save and load a state works properly", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                const modelPath = await getModelFile("Llama-3.2-3B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 1024,
                    sequences: 2
                });
                const contextSequence1 = context.getSequence();
                const contextSequence2 = context.getSequence();

                const chatSession1 = new LlamaChatSession({
                    contextSequence: contextSequence1
                });
                const chatSession2 = new LlamaChatSession({
                    contextSequence: contextSequence2
                });

                const [
                    res1,
                    res2
                ] = await Promise.all([
                    chatSession1.prompt("Remember: locks are not doors", {maxTokens: 4}),
                    chatSession2.prompt("Remember: giraffes are not elephants", {maxTokens: 5})
                ]);
                expect(res1).to.toMatchInlineSnapshot("\"That's a clever\"");
                expect(res2).to.toMatchInlineSnapshot('"I appreciate the reminder."');


                const stateFile1Path = await getTempTestFilePath("state1");
                const state1Tokens = contextSequence1.contextTokens.slice();
                await contextSequence1.saveStateToFile(stateFile1Path);
                test.onTestFinished(() => fs.remove(stateFile1Path));

                expect(contextSequence1.contextTokens).to.eql(state1Tokens);
                expect(contextSequence1.contextTokens.length).toMatchInlineSnapshot("103");
                expect(toBytes((await fs.stat(stateFile1Path)).size)).to.toMatchInlineSnapshot("\"11.27MB\"");


                const stateFile2Path = await getTempTestFilePath("state2");
                const state2Tokens = contextSequence2.contextTokens.slice();
                await contextSequence2.saveStateToFile(stateFile2Path);
                test.onTestFinished(() => fs.remove(stateFile2Path));

                expect(contextSequence2.contextTokens).to.eql(state2Tokens);
                expect(contextSequence2.contextTokens.length).toMatchInlineSnapshot("106");
                expect(toBytes((await fs.stat(stateFile2Path)).size)).to.toMatchInlineSnapshot('"11.6MB"');


                await contextSequence1.clearHistory();
                const contextSequence1TokensState1 = contextSequence1.tokenMeter.getState();

                expect(contextSequence1.contextTokens).to.eql([]);
                expect(contextSequence1TokensState1).toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 99,
                    "usedOutputTokens": 4,
                  }
                `);

                const chatSession1_1 = new LlamaChatSession({
                    contextSequence: contextSequence1
                });
                const res1_1 = await chatSession1_1.prompt("What's the exact thing I told you to remember?", {maxTokens: 10});
                expect(res1_1).to.toMatchInlineSnapshot("\"You didn't tell me to remember anything. This\"");

                await contextSequence1.clearHistory();
                const contextSequence1TokensState2 = contextSequence1.tokenMeter.getState();

                expect(contextSequence1.contextTokens).to.eql([]);
                expect(TokenMeter.diff(contextSequence1TokensState2, contextSequence1TokensState1)).toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 104,
                    "usedOutputTokens": 10,
                  }
                `);

                await contextSequence1.loadStateFromFile(stateFile1Path, {acceptRisk: true});
                expect(contextSequence1.contextTokens).to.eql(state1Tokens);
                expect(contextSequence1.contextTokens.length).toMatchInlineSnapshot("103");

                const contextSequence1TokensState3 = contextSequence1.tokenMeter.getState();
                expect(TokenMeter.diff(contextSequence1TokensState3, contextSequence1TokensState2)).toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 0,
                    "usedOutputTokens": 0,
                  }
                `);

                const chatSession1_2 = new LlamaChatSession({
                    contextSequence: contextSequence1
                });
                chatSession1_2.setChatHistory(chatSession1.getChatHistory());
                const res1_2 = await chatSession1_2.prompt("What's the exact thing I told you to remember?", {maxTokens: 12});
                const contextSequence1TokensState4 = contextSequence1.tokenMeter.getState();

                expect(res1_2).to.toMatchInlineSnapshot('"You told me to "Remember: locks are not doors"."');
                const contextSequence1TokensState4Diff = TokenMeter.diff(contextSequence1TokensState4, contextSequence1TokensState3);
                expect(contextSequence1TokensState4Diff.usedInputTokens).to.be.lessThan(contextSequence1TokensState1.usedInputTokens);
                expect(contextSequence1TokensState4Diff).toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 21,
                    "usedOutputTokens": 12,
                  }
                `);
            });

            test("save and load a state works across different contexts", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                const modelPath = await getModelFile("Llama-3.2-3B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context1 = await model.createContext({
                    contextSize: 1024
                });
                const context2 = await model.createContext({
                    contextSize: 1024
                });
                const contextSequence1 = context1.getSequence();
                const contextSequence2 = context2.getSequence();

                const chatSession1 = new LlamaChatSession({
                    contextSequence: contextSequence1
                });

                const res1 = await chatSession1.prompt("Remember: locks are not doors", {maxTokens: 4});
                expect(res1).to.toMatchInlineSnapshot("\"That's a clever\"");


                const stateFile1Path = await getTempTestFilePath("state1");
                const state1Tokens = contextSequence1.contextTokens.slice();
                await contextSequence1.saveStateToFile(stateFile1Path);
                test.onTestFinished(() => fs.remove(stateFile1Path));
                const contextSequence1TokensState = contextSequence1.tokenMeter.getState();

                expect(contextSequence1.contextTokens).to.eql(state1Tokens);
                expect(contextSequence1.contextTokens.length).toMatchInlineSnapshot("103");
                expect(toBytes((await fs.stat(stateFile1Path)).size)).to.toMatchInlineSnapshot('"11.27MB"');
                expect(contextSequence1TokensState).to.toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 99,
                    "usedOutputTokens": 4,
                  }
                `);

                contextSequence1.dispose();


                const chatSession2 = new LlamaChatSession({
                    contextSequence: contextSequence2
                });
                chatSession2.setChatHistory(chatSession1.getChatHistory());
                await contextSequence2.loadStateFromFile(stateFile1Path, {acceptRisk: true});

                const res2 = await chatSession2.prompt("What did I tell you to remember?", {maxTokens: 12});
                expect(res2).to.toMatchInlineSnapshot('"You told me to remember that "locks are not doors"."');
                const contextSequence2TokensState = contextSequence2.tokenMeter.getState();
                expect(contextSequence2TokensState.usedInputTokens).to.be.lessThan(contextSequence1TokensState.usedInputTokens);
                expect(contextSequence2TokensState).toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 18,
                    "usedOutputTokens": 12,
                  }
                `);
            });

            test("restoring to a smaller context sequence fails", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                const modelPath = await getModelFile("Llama-3.2-3B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context1 = await model.createContext({
                    contextSize: 1024
                });
                const context2 = await model.createContext({
                    contextSize: 100
                });
                const contextSequence1 = context1.getSequence();
                const contextSequence2 = context2.getSequence();
                expect(context2.contextSize).to.eql(256); // the context is actually bigger due to `llama.cpp`'s padding

                const chatSession1 = new LlamaChatSession({
                    contextSequence: contextSequence1
                });

                const res1 = await chatSession1.prompt("Remember: locks are not doors. Also, write a long poem about it", {maxTokens: 154});
                expect(res1).toMatch(/^(A clever reminder indeed.|A wise phrase to ponder)/);


                const stateFile1Path = await getTempTestFilePath("state1");
                const state1Tokens = contextSequence1.contextTokens.slice();
                await contextSequence1.saveStateToFile(stateFile1Path);
                test.onTestFinished(() => fs.remove(stateFile1Path));
                const contextSequence1TokensState = contextSequence1.tokenMeter.getState();

                expect(contextSequence1.contextTokens).to.eql(state1Tokens);
                expect(contextSequence1.contextTokens.length).toMatchInlineSnapshot("262");
                expect(toBytes((await fs.stat(stateFile1Path)).size)).to.toMatchInlineSnapshot('"28.66MB"');
                expect(contextSequence1TokensState).to.toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 108,
                    "usedOutputTokens": 154,
                  }
                `);

                contextSequence1.dispose();


                const chatSession2 = new LlamaChatSession({
                    contextSequence: contextSequence2
                });
                chatSession2.setChatHistory(chatSession1.getChatHistory());
                try {
                    await contextSequence2.loadStateFromFile(stateFile1Path, {acceptRisk: true});
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Failed to load state from file. Current context sequence size may be smaller that the state of the file]");
                }

                expect(contextSequence2.contextTokens).to.eql([]);
            });

            test("restoring to a smaller context sequence fails - 2 sequences", {timeout: 1000 * 60 * 60 * 2}, async (test) => {
                const modelPath = await getModelFile("Llama-3.2-3B-Instruct.Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context1 = await model.createContext({
                    contextSize: 1024
                });
                const context2 = await model.createContext({
                    contextSize: 100,
                    sequences: 2
                });
                const contextSequence1 = context1.getSequence();
                const contextSequence2 = context2.getSequence();

                const chatSession1 = new LlamaChatSession({
                    contextSequence: contextSequence1
                });

                const res1 = await chatSession1.prompt("Remember: locks are not doors", {maxTokens: 4});
                expect(res1).to.toMatchInlineSnapshot("\"That's a clever\"");


                const stateFile1Path = await getTempTestFilePath("state1");
                const state1Tokens = contextSequence1.contextTokens.slice();
                await contextSequence1.saveStateToFile(stateFile1Path);
                test.onTestFinished(() => fs.remove(stateFile1Path));
                const contextSequence1TokensState = contextSequence1.tokenMeter.getState();

                expect(contextSequence1.contextTokens).to.eql(state1Tokens);
                expect(contextSequence1.contextTokens.length).toMatchInlineSnapshot("103");
                expect(toBytes((await fs.stat(stateFile1Path)).size)).to.toMatchInlineSnapshot('"11.27MB"');
                expect(contextSequence1TokensState).to.toMatchInlineSnapshot(`
                  {
                    "usedInputTokens": 99,
                    "usedOutputTokens": 4,
                  }
                `);

                contextSequence1.dispose();


                const chatSession2 = new LlamaChatSession({
                    contextSequence: contextSequence2
                });
                chatSession2.setChatHistory(chatSession1.getChatHistory());
                try {
                    await contextSequence2.loadStateFromFile(stateFile1Path, {acceptRisk: true});
                    expect.unreachable("Should have thrown an error");
                } catch (err) {
                    expect(err).toMatchInlineSnapshot("[Error: Failed to load state from file. Current context sequence size may be smaller that the state of the file]");
                }

                expect(contextSequence2.contextTokens).to.eql([]);
            });
        });
    });
});
