import {describe, expect, it, test} from "vitest";
import {parseGguf} from "../../../src/gguf/parser/parseGguf.js";
import {GgufNetworkFetchFileReader} from "../../../src/gguf/fileReaders/GgufNetworkFetchFileReader.js";
import {simplifyGgufInfoForTestSnapshot} from "../../utils/helpers/simplifyGgufInfoForTestSnapshot.js";

const remoteGGUFModel = "https://huggingface.co/TheBloke/Falcon-180B-Chat-GGUF/resolve/main/falcon-180b-chat.Q6_K.gguf-split-a?download=true";

describe("gguf", async () => {
    describe("parser", async () => {
        test("Magic should be GGUF remote model", {timeout: 1000 * 60 * 10}, async () => {
            const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel});

            const magicText = await fileReader.readStringWithLength(0, 4);

            expect(magicText)
                .toBe("GGUF");
        });

        it("should parse remote gguf model", async () => {
            const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel});

            const metadata = await parseGguf({
                fileReader: fileReader
            });

            expect(simplifyGgufInfoForTestSnapshot(metadata))
                .toMatchSnapshot();
        });

        it("should parse remote gguf model without tensor info", async () => {
            const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel});

            const metadata = await parseGguf({
                fileReader: fileReader,
                readTensorInfo: false
            });

            expect(simplifyGgufInfoForTestSnapshot(metadata))
                .toMatchSnapshot();
        });
    });
});
