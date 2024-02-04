let isInDocumentationMode = false;
let isInCLI = false;

export function getIsInDocumentationMode() {
    return isInDocumentationMode;
}

export function setIsInDocumentationMode(value: boolean) {
    isInDocumentationMode = value;
}

export function getIsRunningFromCLI() {
    return isInCLI;
}

export function setIsRunningFromCLI(value: boolean) {
    isInCLI = value;
}
