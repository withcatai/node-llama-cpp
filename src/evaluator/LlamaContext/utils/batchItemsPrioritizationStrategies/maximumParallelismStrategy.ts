import {BatchItem, PrioritizedBatchItem} from "../../types.js";

export function maximumParallelismStrategy({items, size}: {items: readonly BatchItem[], size: number}) {
    let leftFreeTokens = size;
    const minTokensForEachItem = Math.floor(leftFreeTokens / items.length);

    const res: PrioritizedBatchItem[] = [];
    const clippedItems: PrioritizedBatchItem[] = [];

    for (const item of items) {
        const processAmount = Math.min(item.tokens.length, leftFreeTokens, minTokensForEachItem);
        const prioritizeItem = {item, processAmount};

        res.push(prioritizeItem);
        leftFreeTokens -= processAmount;

        if (processAmount < item.tokens.length)
            clippedItems.push(prioritizeItem);

        if (leftFreeTokens === 0)
            break;
    }

    for (let passesLeft = 3; leftFreeTokens > 0 && clippedItems.length > 0 && passesLeft > 0; passesLeft--) {
        const minIncreaseAmount = Math.ceil(leftFreeTokens / clippedItems.length);

        for (let i = 0; i < clippedItems.length && leftFreeTokens > 0; i++) {
            const prioritizeItem = clippedItems[i]!;
            const unprocessedAmount = prioritizeItem.item.tokens.length - prioritizeItem.processAmount;
            const increaseAmount = Math.min(unprocessedAmount, leftFreeTokens, minIncreaseAmount);
            prioritizeItem.processAmount += increaseAmount;

            if (increaseAmount === unprocessedAmount) {
                clippedItems.splice(i, 1);
                i--;
            }
        }
    }

    clippedItems.sort((a, b) => b.item.evaluationPriority - a.item.evaluationPriority);

    for (let i = 0; i < clippedItems.length && leftFreeTokens > 0; i++) {
        const prioritizeItem = clippedItems[i]!;
        const unprocessedAmount = prioritizeItem.item.tokens.length - prioritizeItem.processAmount;
        const increaseAmount = Math.min(unprocessedAmount, leftFreeTokens);
        prioritizeItem.processAmount += increaseAmount;

        if (increaseAmount === unprocessedAmount) {
            clippedItems.splice(i, 1);
            i--;
        }
    }

    return res;
}
