import {describe, expect, it, test} from "vitest";
import {GgufFsFileReader} from "../../../../src/gguf/fileReaders/GgufFsFileReader.js";
import {parseGguf} from "../../../../src/gguf/parser/parseGguf.js";
import {getModelFile} from "../../../utils/modelFiles.js";
import {readGgufFileInfo} from "../../../../src/gguf/readGgufFileInfo.js";
import {simplifyGgufInfoForTestSnapshot} from "../../../utils/helpers/simplifyGgufInfoForTestSnapshot.js";

describe("gguf", async () => {
    describe("parser", async () => {
        const modelPath = await getModelFile("functionary-small-v2.5.Q4_0.gguf");

        test("Magic should be GGUF local model", async () => {
            const fileReader = new GgufFsFileReader({filePath: modelPath});
            const magicText = await fileReader.readStringWithLength(0, 4);

            expect(magicText).toBe("GGUF");
        });

        it("should parse local gguf model", async () => {
            const fileReader = new GgufFsFileReader({filePath: modelPath});

            const metadata = await parseGguf({
                fileReader: fileReader
            });
            expect(metadata.tensorInfo!.length).to.be.eql(Number(metadata.tensorCount));

            expect(simplifyGgufInfoForTestSnapshot(metadata)).toMatchSnapshot();
        });

        it("should fetch GGUF metadata", async () => {
            const ggufMetadataParseResult = await readGgufFileInfo(modelPath);

            expect(simplifyGgufInfoForTestSnapshot(ggufMetadataParseResult)).toMatchSnapshot();
        });
    });
});
