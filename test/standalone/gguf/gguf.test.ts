import {describe, expect, it, test} from "vitest";
import GGUFParser from "../../../src/gguf/ggufParser/GGUFParser.js";
import GGUFFetchStream from "../../../src/gguf/ggufParser/stream/GGUFFetchStream.js";

const remoteGGUFModel = "https://huggingface.co/TheBloke/Falcon-180B-Chat-GGUF/resolve/main/falcon-180b-chat.Q6_K.gguf-split-a?download=true";

describe("GGUF Parser", async () => {
    test("Magic should be GGUF remote model", {timeout: 1000 * 60 * 10}, async () => {
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
    });
});
