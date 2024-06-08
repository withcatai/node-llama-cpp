import {describe, expect, test} from "vitest";
import {FunctionaryChatWrapper, LlamaChatSession} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("functionary", () => {
    describe("chat session", () => {
        test("restore chat history", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(FunctionaryChatWrapper);

            let res = await chatSession.prompt("How much is 6+6");

            if (res.endsWith("."))
                res = res.slice(0, -".".length);

            expect(res).to.eql("6 + 6 = 12");

            const chatHistory = chatSession.getChatHistory();

            chatSession.dispose();
            const chatSession2 = new LlamaChatSession({
                contextSequence: context.getSequence()
            });
            chatSession2.setChatHistory(chatHistory);

            let res2 = await chatSession2.prompt("Repeat your answer");

            if (res2.endsWith("."))
                res2 = res2.slice(0, -".".length);

            expect(res2).to.eql("6 + 6 = 12");
        });

        test("disposing a context sequences removes the current state", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const contextSequence = context.getSequence();
            const chatSession = new LlamaChatSession({
                contextSequence,
                autoDisposeSequence: false
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(FunctionaryChatWrapper);

            let res = await chatSession.prompt("How much is 6+6");

            if (res.endsWith("."))
                res = res.slice(0, -".".length);

            expect(res).to.eql("6 + 6 = 12");
            const tokenMeterState = contextSequence.tokenMeter.getState();
            expect(tokenMeterState).to.toMatchInlineSnapshot(`
              {
                "usedInputTokens": 80,
                "usedOutputTokens": 9,
                "usedRestoreStateTokens": 0,
              }
            `);

            chatSession.dispose();
            contextSequence.dispose();

            const contextSequence2 = context.getSequence();
            const chatSession2 = new LlamaChatSession({
                contextSequence: contextSequence2
            });

            let res2 = await chatSession2.prompt("How much is 6+6+6");

            if (res2.endsWith("."))
                res2 = res2.slice(0, -".".length);

            const tokenMeterState2 = contextSequence2.tokenMeter.getState();
            expect(tokenMeterState2).to.toMatchInlineSnapshot(`
              {
                "usedInputTokens": 82,
                "usedOutputTokens": 14,
                "usedRestoreStateTokens": 0,
              }
            `);
            expect(tokenMeterState2.usedInputTokens).to.be.greaterThanOrEqual(tokenMeterState.usedInputTokens);
            expect(res2).to.eql("The sum of 6+6+6 is 18");
        });

        test("reusing a context sequences utilizes existing state", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const contextSequence = context.getSequence();
            const chatSession = new LlamaChatSession({
                contextSequence,
                autoDisposeSequence: false
            });

            expect(chatSession.chatWrapper).to.be.an.instanceof(FunctionaryChatWrapper);

            let res = await chatSession.prompt("How much is 6+6");

            if (res.endsWith("."))
                res = res.slice(0, -".".length);

            expect(res).to.eql("6 + 6 = 12");
            const tokenMeterState = contextSequence.tokenMeter.getState();
            expect(tokenMeterState).to.toMatchInlineSnapshot(`
              {
                "usedInputTokens": 80,
                "usedOutputTokens": 9,
                "usedRestoreStateTokens": 0,
              }
            `);

            chatSession.dispose();
            const chatSession2 = new LlamaChatSession({
                contextSequence
            });

            let res2 = await chatSession2.prompt("How much is 6+6+6");

            if (res2.endsWith("."))
                res2 = res2.slice(0, -".".length);

            const tokenMeterStateDiff = contextSequence.tokenMeter.diff(tokenMeterState);
            expect(tokenMeterStateDiff).to.toMatchInlineSnapshot(`
              {
                "usedInputTokens": 6,
                "usedOutputTokens": 14,
                "usedRestoreStateTokens": 0,
              }
            `);
            expect(tokenMeterStateDiff.usedInputTokens).to.be.lessThan(tokenMeterState.usedInputTokens);
            expect(res2).to.eql("The sum of 6+6+6 is 18");
        });
    });
});
