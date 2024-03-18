import {describe, expect, it, test} from "vitest";
import {GgufParser} from "../../../src/gguf/ggufParser/GgufParser.js";
import {GgufFetchFileReader} from "../../../src/gguf/ggufParser/fileReaders/GgufFetchFileReader.js";

const remoteGGUFModel = "https://huggingface.co/TheBloke/Falcon-180B-Chat-GGUF/resolve/main/falcon-180b-chat.Q6_K.gguf-split-a?download=true";

describe("GGUF Parser", async () => {
    test("Magic should be GGUF remote model", {timeout: 1000 * 60 * 10}, async () => {
        const fileReader = new GgufFetchFileReader({url: remoteGGUFModel});

        const magic = await fileReader.readByteRange(0, 4);
        const magicText = String.fromCharCode(...magic);

        expect(magicText).toBe("GGUF");
    });

    it("should parse remote gguf model", async () => {
        const fileReader = new GgufFetchFileReader({url: remoteGGUFModel});
        const ggufParser = new GgufParser({fileReader: fileReader});

        const metadata = await ggufParser.parseMetadata();

        expect(metadata).toMatchSnapshot();
    });
});
