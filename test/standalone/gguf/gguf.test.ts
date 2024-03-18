import {describe, expect, it, test} from "vitest";
import {GgufParser} from "../../../src/gguf/ggufParser/GgufParser.js";
import {GgufFetchStream} from "../../../src/gguf/ggufParser/stream/GgufFetchStream.js";

const remoteGGUFModel = "https://huggingface.co/TheBloke/Falcon-180B-Chat-GGUF/resolve/main/falcon-180b-chat.Q6_K.gguf-split-a?download=true";

describe("GGUF Parser", async () => {
    test("Magic should be GGUF remote model", {timeout: 1000 * 60 * 10}, async () => {
        const stream = new GgufFetchStream({url: remoteGGUFModel});

        const magic = await stream.readByteRange(0, 4);
        const magicText = String.fromCharCode(...magic);

        expect(magicText).toBe("GGUF");
    });

    it("should parse remote gguf model", async () => {
        const stream = new GgufFetchStream({url: remoteGGUFModel});
        const ggufParser = new GgufParser({stream});

        const metadata = await ggufParser.parseMetadata();

        expect(metadata).toMatchSnapshot();
    });
});
