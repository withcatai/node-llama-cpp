import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {MetadataKeyValueRecord, MetadataNestedObject, MetadataValue} from "../types/GgufFileInfoTypes.js";

export function convertMetadataKeyValueRecordToNestedObject(
    keyValueRecord: MetadataKeyValueRecord,
    {
        logOverrideWarnings = true,
        ignoreKeys = []
    }: {
        logOverrideWarnings?: boolean,
        ignoreKeys?: string[]
    } = {}
) {
    const nestedObject: Record<string, MetadataValue> = {};
    const ignoreKeySet = new Set(ignoreKeys);

    for (const [key, value] of Object.entries(keyValueRecord)) {
        if (ignoreKeySet.has(key))
            continue;

        const {lastObject, lastKey} = getNestedObject(key, nestedObject);
        if (Object.hasOwn(lastObject, lastKey) && logOverrideWarnings)
            console.warn(getConsoleLogPrefix() + `Metadata key "${key}" is already occupied by a value. Overwriting it.`);

        lastObject[lastKey] = value;
    }

    return nestedObject;
}

function getNestedObject(key: string, nestedObject: MetadataNestedObject) {
    const nestedKey = key.split(".");
    const lastKey = nestedKey.pop()!;

    let currentObject = nestedObject;

    while (nestedKey.length > 0) {
        const currentKey = nestedKey.shift()!;
        if (!Object.hasOwn(currentObject, currentKey)) {
            const nextCurrentObject = {};
            currentObject[currentKey] = nextCurrentObject;

            currentObject = nextCurrentObject;
        } else {
            const value = currentObject[currentKey];
            if (value instanceof Array || value == null || typeof value !== "object")
                throw new Error(
                    `Cannot create nested object for key "${key}". The key "${currentKey}" is already occupied by a non-object value.`
                );

            currentObject = value;
        }
    }

    return {
        lastObject: currentObject,
        lastKey
    };
}
