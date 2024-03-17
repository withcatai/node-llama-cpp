import type {AddonModelArchName, AddonModelFileTypeName, AddonModelTypeName, ModelTypeDescription} from "../bindings/AddonTypes.js";

export function parseModelTypeDescription(modelTypeDescription: ModelTypeDescription) {
    const [arch, type, ...fileTypeParts] = modelTypeDescription.split(" ");

    return {
        arch: arch as AddonModelArchName,
        type: type as AddonModelTypeName,
        fileType: fileTypeParts.join(" ") as AddonModelFileTypeName
    };
}
