import {describe, expect, it, test} from "vitest";
import {GgufParser} from "../../../src/gguf/ggufParser/GgufParser.js";
import {GgufNetworkFetchFileReader} from "../../../src/gguf/ggufParser/fileReaders/GgufNetworkFetchFileReader.js";
import {simplifyGgufInfoForTestSnapshot} from "../../utils/helpers/simplifyGgufInfoForTestSnapshot.js";

const remoteGGUFModel = "https://huggingface.co/TheBloke/Falcon-180B-Chat-GGUF/resolve/main/falcon-180b-chat.Q6_K.gguf-split-a?download=true";

describe("GGUF Parser", async () => {
    test("Magic should be GGUF remote model", {timeout: 1000 * 60 * 10}, async () => {
        const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel});

        const magic = await fileReader.readByteRange(0, 4);
        const magicText = String.fromCharCode(...magic);

        expect(magicText).toBe("GGUF");
    });

    it("should parse remote gguf model", async () => {
        const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel});
        const ggufParser = new GgufParser({
            fileReader: fileReader
        });

        const metadata = await ggufParser.parseFileInfo();

        expect(simplifyGgufInfoForTestSnapshot(metadata)).toMatchSnapshot();
    });

    it("should parse remote gguf model without tensor info", async () => {
        const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel});
        const ggufParser = new GgufParser({
            fileReader: fileReader,
            readTensorInfo: false
        });

        const metadata = await ggufParser.parseFileInfo();

        expect(simplifyGgufInfoForTestSnapshot(metadata)).toMatchSnapshot();
    });
});
