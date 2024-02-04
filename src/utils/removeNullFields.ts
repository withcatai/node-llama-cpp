export function removeNullFields<T extends object>(obj: T): T {
    const newObj: T = Object.assign({}, obj);

    for (const key in obj) {
        if (newObj[key] == null)
            delete newObj[key];
    }

    return newObj;
}

export function removeUndefinedFields<T extends object>(obj: T): T {
    const newObj: T = Object.assign({}, obj);

    for (const key in obj) {
        if (newObj[key] === undefined)
            delete newObj[key];
    }

    return newObj;
}
