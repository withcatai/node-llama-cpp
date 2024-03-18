import {describe, expect, it, test} from "vitest";
import {GgufFsReadStream} from "../../../src/gguf/ggufParser/stream/GgufFsReadStream.js";
import {GgufParser} from "../../../src/gguf/ggufParser/GgufParser.js";
import {getModelFile} from "../../utils/modelFiles.js";
import GGUFInsights from "../../../src/gguf/GGUFInsights.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import GGUFMetadata from "../../../src/gguf/GGUFMetadata.js";

describe("GGUF Parser", async () => {
    const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");

    test("Magic should be GGUF local model", async () => {
        const stream = new GgufFsReadStream({filePath: modelPath});
        const magic = await stream.readByteRange(0, 4);
        const magicText = String.fromCharCode(...magic);

        expect(magicText).toBe("GGUF");
    });

    it("should parse local gguf model", async () => {
        const stream = new GgufFsReadStream({filePath: modelPath});
        const ggufParser = new GgufParser({stream});

        const metadata = await ggufParser.parseMetadata();

        expect(metadata).toMatchSnapshot();
    });

    it("should calculate GGUF VRAM Usage", async () => {
        const stream = new GgufFsReadStream({filePath: modelPath});
        const ggufParser = new GgufParser({stream});

        const metadata = await ggufParser.parseMetadata();

        const ggufInsights = new GGUFInsights(metadata);

        const llama = await getTestLlama();
        const model = await llama.loadModel({
            modelPath: modelPath
        });

        const usedRam = llama.getVramState().used;

        expect(ggufInsights.VRAMUsage).toMatchInlineSnapshot("4474643028.666667");
        expect(usedRam).to.be.gte(3.5 * Math.pow(1024, 3));
        expect(usedRam).to.be.lte(4.5 * Math.pow(1024, 3));
        await model.dispose();
    });

    it("should fetch GGUF metadata", async () => {
        const ggufMetadata = new GGUFMetadata(modelPath);
        await ggufMetadata.parse();

        expect(ggufMetadata.metadata).toMatchSnapshot();
        expect(ggufMetadata.insights.VRAMUsage).toMatchInlineSnapshot("4474643028.666667");
    });
});
