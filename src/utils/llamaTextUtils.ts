import {LlamaText, SpecialToken, SpecialTokensText} from "./LlamaText.js";

export function trimCommonLlamaTextPrefix(target: LlamaText, matchStart: LlamaText) {
    for (
        let commonStartLength = 0;
        commonStartLength < target.values.length && commonStartLength < matchStart.values.length;
        commonStartLength++
    ) {
        const targetValue = target.values[commonStartLength];
        const matchStartValue = matchStart.values[commonStartLength];

        if (typeof targetValue === "string" && typeof matchStartValue === "string") {
            const commonLength = findCommonStartLength(targetValue, matchStartValue);
            if (commonLength === matchStartValue.length && commonLength === targetValue.length)
                continue;

            return LlamaText([
                targetValue.slice(commonLength),
                ...target.values.slice(commonStartLength + 1)
            ]);
        } else if (targetValue instanceof SpecialTokensText && matchStartValue instanceof SpecialTokensText) {
            const commonLength = findCommonStartLength(targetValue.value, matchStartValue.value);
            if (commonLength === targetValue.value.length && commonLength === matchStartValue.value.length)
                continue;

            return LlamaText([
                new SpecialTokensText(targetValue.value.slice(commonLength)),
                ...target.values.slice(commonStartLength + 1)
            ]);
        } else if (targetValue instanceof SpecialToken && matchStartValue instanceof SpecialToken) {
            if (targetValue.value === matchStartValue.value)
                continue;
        } else if (LlamaText(targetValue ?? "").compare(LlamaText(matchStartValue ?? "")))
            continue;

        return LlamaText(target.values.slice(commonStartLength));
    }

    return LlamaText(target.values.slice(matchStart.values.length));
}

export function trimCommonLlamaTextSuffix(target: LlamaText, matchEnd: LlamaText, onlyIfFullMatches: boolean = false) {
    for (
        let commonEndLength = 0;
        commonEndLength < target.values.length && commonEndLength < matchEnd.values.length;
        commonEndLength++
    ) {
        const targetValue = target.values[target.values.length - 1 - commonEndLength];
        const matchEndValue = matchEnd.values[matchEnd.values.length - 1 - commonEndLength];

        if (typeof targetValue === "string" && typeof matchEndValue === "string") {
            const commonLength = findCommonEndLength(targetValue, matchEndValue);
            if (commonLength === matchEndValue.length && commonLength === targetValue.length)
                continue;
            else if (onlyIfFullMatches && (commonLength !== matchEndValue.length || commonEndLength !== matchEnd.values.length - 1))
                return target;

            return LlamaText([
                ...target.values.slice(0, target.values.length - commonEndLength - 1),
                targetValue.slice(0, targetValue.length - commonLength)
            ]);
        } else if (targetValue instanceof SpecialTokensText && matchEndValue instanceof SpecialTokensText) {
            const commonLength = findCommonEndLength(targetValue.value, matchEndValue.value);
            if (commonLength === targetValue.value.length && commonLength === matchEndValue.value.length)
                continue;
            else if (onlyIfFullMatches && (commonLength !== matchEndValue.value.length || commonEndLength !== matchEnd.values.length - 1))
                return target;

            return LlamaText([
                ...target.values.slice(0, target.values.length - commonEndLength - 1),
                new SpecialTokensText(targetValue.value.slice(0, targetValue.value.length - commonLength))
            ]);
        } else if (targetValue instanceof SpecialToken && matchEndValue instanceof SpecialToken) {
            if (targetValue.value === matchEndValue.value)
                continue;
        } else if (LlamaText(targetValue ?? "").compare(LlamaText(matchEndValue ?? "")))
            continue;

        if (onlyIfFullMatches)
            return target;

        return LlamaText(target.values.slice(0, target.values.length - commonEndLength));
    }

    if (onlyIfFullMatches && target.values.length < matchEnd.values.length)
        return target;

    return LlamaText(target.values.slice(0, target.values.length - matchEnd.values.length));
}

function findCommonStartLength(text1: string, text2: string) {
    let commonStartLength = 0;
    while (commonStartLength < text1.length && commonStartLength < text2.length) {
        if (text1[commonStartLength] !== text2[commonStartLength])
            break;

        commonStartLength++;
    }

    return commonStartLength;
}

function findCommonEndLength(text1: string, text2: string) {
    let commonEndLength = 0;
    while (commonEndLength < text1.length && commonEndLength < text2.length) {
        if (text1[text1.length - 1 - commonEndLength] !== text2[text2.length - 1 - commonEndLength])
            break;

        commonEndLength++;
    }

    return commonEndLength;
}
