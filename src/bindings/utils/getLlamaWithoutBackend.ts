import {withLock} from "lifecycle-utils";
import {getLlamaForOptions} from "../getLlama.js";
import {LlamaLogLevel} from "../types.js";
import {Llama} from "../Llama.js";

let sharedLlamaWithoutBackend: Llama | null = null;

/**
 * This is used to access various methods in the addon side without actually using a backend
 */
export async function getLlamaWithoutBackend() {
    if (sharedLlamaWithoutBackend != null)
        return sharedLlamaWithoutBackend;

    return await withLock([getLlamaWithoutBackend, "loadAddon"], async () => {
        if (sharedLlamaWithoutBackend != null)
            return sharedLlamaWithoutBackend;

        try {
            sharedLlamaWithoutBackend = await getLlamaForOptions({
                gpu: false,
                progressLogs: false,
                logLevel: LlamaLogLevel.error,
                build: "never",
                usePrebuiltBinaries: true,
                vramPadding: 0
            }, {
                skipLlamaInit: true
            });
        } catch (err) {
            sharedLlamaWithoutBackend = await getLlamaForOptions({
                progressLogs: false,
                logLevel: LlamaLogLevel.error,
                build: "never",
                usePrebuiltBinaries: true,
                vramPadding: 0
            }, {
                skipLlamaInit: true
            });
        }

        return sharedLlamaWithoutBackend;
    });
}
