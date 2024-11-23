import {describe, expect, test} from "vitest";
import {LlamaChatSession, Llama3_2LightweightChatWrapper} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("llama 3.2", () => {
    describe("chatSession", () => {
        test("resolved to the correct chat wrapper", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Llama-3.2-3B-Instruct.Q4_K_M.gguf");
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

            expect(chatSession.chatWrapper).to.be.instanceof(Llama3_2LightweightChatWrapper);
        });
    });
});
