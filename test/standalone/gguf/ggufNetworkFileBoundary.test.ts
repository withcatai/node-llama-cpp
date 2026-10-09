import http from "node:http";
import {AddressInfo} from "node:net";
import {describe, expect, test} from "vitest";
import {readGgufFileInfo} from "../../../src/gguf/readGgufFileInfo.js";
import {defaultExtraAllocationSize} from "../../../src/gguf/consts.js";

describe("gguf network file boundaries", () => {
    test("reads metadata ending exactly at EOF after expanding the buffer", async () => {
        const name = "a".repeat(defaultExtraAllocationSize + 32);
        await withRangeServer(createGguf(name), async (url) => {
            const info = await readGgufFileInfo(url, {
                readTensorInfo: false,
                fetchRetryOptions: {retries: 0}
            });

            expect(info.metadata.general?.name).to.equal(name);
            expect(info.tensorCount).to.equal(0);
        });
    });

    test("reads metadata when more bytes follow the requested range", async () => {
        const name = "a".repeat(defaultExtraAllocationSize + 32);
        const data = Buffer.concat([createGguf(name), Buffer.alloc(32)]);
        await withRangeServer(data, async (url) => {
            const info = await readGgufFileInfo(url, {
                readTensorInfo: false,
                fetchRetryOptions: {retries: 0}
            });

            expect(info.metadata.general?.name).to.equal(name);
        });
    });

    test("rejects metadata truncated before the end of the requested range", async () => {
        const name = "a".repeat(defaultExtraAllocationSize + 32);
        const data = createGguf(name).subarray(0, -1);
        await withRangeServer(data, async (url) => {
            await expect(readGgufFileInfo(url, {
                readTensorInfo: false,
                fetchRetryOptions: {retries: 0}
            })).rejects.toThrow("Expected buffer to be long enough for the requested byte range");
        });
    });
});

function createGguf(name: string) {
    const key = Buffer.from("general.name");
    const value = Buffer.from(name);
    const header = Buffer.alloc(24);
    header.write("GGUF");
    header.writeUInt32LE(3, 4);
    header.writeBigUInt64LE(0n, 8);
    header.writeBigUInt64LE(1n, 16);

    const keyLength = Buffer.alloc(8);
    keyLength.writeBigUInt64LE(BigInt(key.length));
    const valueType = Buffer.alloc(4);
    valueType.writeUInt32LE(8); // GGUF string
    const valueLength = Buffer.alloc(8);
    valueLength.writeBigUInt64LE(BigInt(value.length));

    return Buffer.concat([header, keyLength, key, valueType, valueLength, value]);
}

async function withRangeServer(data: Buffer, callback: (url: string) => Promise<void>) {
    const server = http.createServer((request, response) => {
        const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? "");
        if (range == null) {
            response.writeHead(400).end();
            return;
        }

        const start = Number(range[1]);
        const end = Math.min(Number(range[2]), data.length - 1);
        response.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${data.length}`
        });
        response.end(data.subarray(start, end + 1));
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    try {
        const address = server.address() as AddressInfo;
        await callback(`http://127.0.0.1:${address.port}/model.gguf`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error == null ? resolve() : reject(error)));
        });
    }
}
