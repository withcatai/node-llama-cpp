import {SnapshotSerializer} from "vitest";

export default {
    serialize(value, config, indentation, depth, refs, printer) {
        return "new SpecialTokensText(" + printer(value.value, config, indentation, depth, refs) + ")";
    },
    test(value) {
        return value != null && Object.getPrototypeOf(value).constructor.name === "SpecialTokensText";
    }
} satisfies SnapshotSerializer;
