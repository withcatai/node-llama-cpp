export function findBestOption<const O>({generator, score}: {
    generator: () => Generator<O>,
    score: (option: O) => number | null
}) {
    let bestOption: O | null = null;
    let bestScore: number | null = null;

    for (const option of generator()) {
        const currentScore = score(option);

        if (currentScore === Infinity)
            return option;

        if (currentScore != null && (bestScore == null || currentScore > bestScore)) {
            bestOption = option;
            bestScore = currentScore;
        }
    }

    return bestOption;
}

/**
 * This algorithm assumes that the first non-null score is the best one and from there
 * it then starts iterating by 1 index forward to find the actual best option.
 * 
 * It prefills the next `prefill` options to jump ahead an score fewer options to find the best one faster and more efficiently.
 */
export async function findFirstNonNullBestOptionAsync<const O>({generator, score, prefill}: {
    generator: () => Generator<O>,
    score: (option: O) => Promise<number | null>,
    prefill: number
}): Promise<O | null> {
    const iterator = generator();
    let iteratorDone = false;
    const options: O[] = [];
    const scores = new Map<number, number | null>();

    function getIndex(index: number) {
        if (index < options.length)
            return options[index]!;

        if (iteratorDone)
            return undefined;

        while (options.length <= index) {
            const nextOption = iterator.next();
            if (nextOption.done) {
                iteratorDone = true;
                return undefined;
            }

            options.push(nextOption.value);
        }

        return options[index];
    }

    let step = Math.max(1, (Number.isFinite(prefill) ? Math.floor(prefill) : 5));
    let currentIndex = 0;
    let bestIndex: number | null = null;
    let bestScore: number | null = null;
    while (true) {
        if (currentIndex < 0)
            currentIndex = 0;

        const option = getIndex(currentIndex);
        if (option == null)
            break;

        const currentScore = scores.get(currentIndex) ?? await score(option);
        if (!scores.has(currentIndex))
            scores.set(currentIndex, currentScore);

        if (currentScore == null) {
            if (step < 0)
                step = Math.max(1, Math.floor(-step / 2));

            while (bestIndex != null && currentIndex + step >= bestIndex && step !== 1)
                step = Math.max(1, Math.floor(step / 2));
            
            let nextIndex = currentIndex + step;
            if (getIndex(nextIndex) == null) {
                nextIndex = options.length - 1;
                if (currentIndex === nextIndex)
                    break;
            }
            currentIndex = nextIndex;
        } else if (bestScore == null || currentScore > bestScore) {
            bestIndex = currentIndex;
            bestScore = currentScore;

            step = -Math.max(1, Math.floor(Math.abs(step) / 2));

            let nextIndex = currentIndex + step;
            if (nextIndex < 0) {
                nextIndex = 0;
                step = Math.max(1, Math.floor(Math.abs(step) / 2));
                nextIndex = currentIndex + step;
            }

            if (getIndex(nextIndex) == null) {
                nextIndex = options.length - 1;
                if (currentIndex === nextIndex)
                    break;
            }

            currentIndex = nextIndex;
        } else if (bestIndex != null && currentScore < bestScore && currentIndex > bestIndex) {
            step = -Math.max(1, Math.floor(Math.abs(currentIndex - bestIndex) / 2));
            currentIndex = bestIndex + step;
        } else if (bestIndex != null && currentScore < bestScore && currentIndex < bestIndex) {
            if (step < 0)
                step = Math.max(1, Math.floor(Math.abs(bestIndex - currentIndex) / 2));

            currentIndex = currentIndex + step;
        } else if (currentScore === bestScore && currentIndex === bestIndex &&
            (step === 1 || currentIndex === 0)
        ) {
            if (scores.has(currentIndex + 1) || (iteratorDone && currentIndex === options.length - 1))
                break;

            step = 1;
            currentIndex = bestIndex + step;
        } else
            currentIndex = currentIndex + step;

        if (iteratorDone && scores.size === options.length && bestIndex != null)
            break;
    }

    if (bestIndex == null)
        return null;

    return options[bestIndex] ?? null;
}
