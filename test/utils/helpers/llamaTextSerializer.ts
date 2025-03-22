import {SnapshotSerializer} from "vitest";
import {isLlamaText} from "../../../src/index.js";

export default {
    serialize(value, config, indentation, depth, refs, printer) {
        return "LlamaText(" + printer(value.values, config, indentation, depth, refs) + ")";
    },
    test(value) {
        return isLlamaText(value);
    }
} satisfies SnapshotSerializer;
