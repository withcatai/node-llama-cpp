export function removeNullFields<const T extends object>(obj: T): T {
    const newObj: T = Object.assign({}, obj);

    for (const key in obj) {
        if (newObj[key] == null)
            delete newObj[key];
    }

    return newObj;
}

export function removeUndefinedFields<const T extends object>(obj: T): T {
    const newObj: T = Object.assign({}, obj);

    for (const key in obj) {
        if (newObj[key] === undefined)
            delete newObj[key];
    }

    return newObj;
}
