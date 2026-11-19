import {describe, expect, test} from "vitest";
import {GgufNetworkFetchFileReader} from "../../../src/gguf/fileReaders/GgufNetworkFetchFileReader.js";

const remoteGGUFModel = "https://huggingface.co/ggml-org/models-moved/resolve/499bc8821c6b12b4e53c5bffcb21ec206f212d81/tinyllamas/stories260K.gguf";
const remoteGGUFModelSize = 1185376;

describe("gguf network file boundaries", () => {
    test("reads the final byte after expanding the buffer to EOF", {timeout: 1000 * 60 * 10}, async () => {
        const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel, retryOptions: {retries: 0}});

        expect(await fileReader.readUint8(remoteGGUFModelSize - 1))
            .toBe(63);
    });

    test("reads bytes before EOF", {timeout: 1000 * 60 * 10}, async () => {
        const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel, retryOptions: {retries: 0}});

        expect(await fileReader.readStringWithLength(0, 4))
            .toBe("GGUF");
    });

    test("rejects a byte beyond EOF", {timeout: 1000 * 60 * 10}, async () => {
        const fileReader = new GgufNetworkFetchFileReader({url: remoteGGUFModel, retryOptions: {retries: 0}});

        await expect(fileReader.readUint8(remoteGGUFModelSize))
            .rejects.toThrow("Expected buffer to be long enough for the requested byte range");
    });
});
