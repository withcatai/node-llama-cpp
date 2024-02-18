import {describe, expect, it} from "vitest";
import GGUFReadStream from "../../src/gguf/gguf-parser/stream/GGUFReadStream.js";
import GGUFParser from "../../src/gguf/gguf-parser/GGUFParser.js";
import GGUFFetchStream from "../../src/gguf/gguf-parser/stream/GGUFFetchStream.js";
import {getModelFile} from "../utils/modelFiles.js";
import GGUFInsights from "../../src/gguf/GGUFInsights.js";
import {getTestLlama} from "../utils/getTestLlama.js";
import {LlamaModel} from "../../src/index.js";
import GGUFMetadata from '../../src/gguf/GGUFMetadata.js';

const remoteGGUFModel = "https://huggingface.co/TheBloke/Falcon-180B-Chat-GGUF/resolve/main/falcon-180b-chat.Q6_K.gguf-split-a?download=true";

describe("GGUF Parser", async () => {
    const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");

    it("Magic should be GGUF local model", async () => {
        const stream = new GGUFReadStream(modelPath);
        const magic = await stream.readNBytes(4);
        const magicText = String.fromCharCode(...magic);

        expect(magicText).toBe("GGUF");
    });

    it("should parse local gguf model", async () => {
        const stream = new GGUFReadStream(modelPath);

        const ggufParser = new GGUFParser(stream);
        const metadata = await ggufParser.parseMetadata();

        expect(metadata).toMatchSnapshot();
    });

    it("Magic should be GGUF remote model", async () => {
        const stream = new GGUFFetchStream(remoteGGUFModel);

        const magic = await stream.readNBytes(4);
        const magicText = String.fromCharCode(...magic);

        expect(magicText).toBe("GGUF");
    });

    it("should parse remote gguf model", async () => {
        const stream = new GGUFFetchStream(remoteGGUFModel);

        const ggufParser = new GGUFParser(stream);
        const metadata = await ggufParser.parseMetadata();

        expect(metadata).toMatchSnapshot();
    }, {timeout: 0});

    it("should calculate GGUF VRAM Usage", async () => {
        const stream = new GGUFReadStream(modelPath);

        const ggufParser = new GGUFParser(stream);
        const metadata = await ggufParser.parseMetadata();

        const ggufInsights = new GGUFInsights(metadata);

        const llama = await getTestLlama();
        new LlamaModel({
            modelPath: modelPath,
            llama
        });

        const usedRam = llama.getVramState().used;

        expect(ggufInsights.VRAMUsage).toMatchInlineSnapshot(`4474643028.666667`);
        expect(usedRam).to.be.gte(3.5 * Math.pow(1024, 3));
        expect(usedRam).to.be.lte(4.5 * Math.pow(1024, 3));
    });

    it("should fetch GGUF metadata", async () => {
        const ggufMetadata = new GGUFMetadata(modelPath);
        await ggufMetadata.parse();

        expect(ggufMetadata.metadata).toMatchSnapshot();
        expect(ggufMetadata.insights.VRAMUsage).toMatchInlineSnapshot(`4474643028.666667`);
    });
});
