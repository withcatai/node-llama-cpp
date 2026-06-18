import {withLock} from "lifecycle-utils";

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
export async function findFirstNonNullBestOptionAsync<const O>({
    generator, score, prefill, initialSkip, predictiveScoring = 0
}: {
    generator: () => Generator<O>,
    score: (option: O) => Promise<number | null>,
    prefill: number,
    initialSkip?: number,
    predictiveScoring?: 0 | 1 | 2 | 3
}): Promise<O | null> {
    const iterator = generator();
    let iteratorDone = false;
    const options: O[] = [];
    const scores = new Map<number, number | null>();
    let bestIndex: number | null = null;
    let bestScore: number | null = null;

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

    function getScore(index: number, updateScore: boolean = false) {
        const currentScore = scores.get(index);
        if (currentScore != null)
            return currentScore;

        const option = getIndex(index);
        if (option == null)
            return null;

        return withLock([scores, index], async () => {
            const currentScore = scores.get(index) ?? await score(option);
            if (!scores.has(index))
                scores.set(index, currentScore);

            if (updateScore && currentScore != null && (bestScore == null || currentScore > bestScore)) {
                bestIndex = index;
                bestScore = currentScore;
            }

            return currentScore;
        });
    }

    if (initialSkip != null && getIndex(initialSkip) == null)
        initialSkip = undefined;

    let step = Math.max(1, (Number.isFinite(prefill) ? Math.floor(prefill) : 5));
    let currentIndex = initialSkip ?? 0;
    while (true) {
        if (currentIndex < 0)
            currentIndex = 0;

        const option = getIndex(currentIndex);
        if (option == null)
            break;

        const currentScorePromisable = getScore(currentIndex);
        if (currentScorePromisable instanceof Promise) {
            let predictionsLeft = predictiveScoring;
            
            if (currentIndex === 0) {
                if (predictionsLeft > 0 && step > 0) {
                    ignorePromiseError(getScore(1, true));
                    predictionsLeft--;
                }

                const stepA = currentIndex + step;
                if (predictionsLeft > 0 && getIndex(stepA) != null) {
                    ignorePromiseError(getScore(stepA, true));
                    predictionsLeft--;
                }
            } else {
                for (let i = 1; i < predictiveScoring + 1 && predictionsLeft > 0; i++) {
                    const stepA = currentIndex + (step * i);
                    if (predictionsLeft > 0 && getIndex(stepA) != null) {
                        ignorePromiseError(getScore(stepA, true));
                        predictionsLeft--;
                    }
        
                    const stepB = currentIndex - accumulateHalvedValues(step, i);
                    if (predictionsLeft > 0 && getIndex(stepB) != null) {
                        ignorePromiseError(getScore(stepB, true));
                        predictionsLeft--;
                    }
        
                    const stepC = currentIndex + accumulateHalvedValues(step, i);
                    if (predictionsLeft > 0 && getIndex(stepC) != null) {
                        ignorePromiseError(getScore(stepC, true));
                        predictionsLeft--;
                    }
                }
            }
        }

        const currentScore = currentScorePromisable instanceof Promise
            ? await currentScorePromisable
            : currentScorePromisable;

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

            if (currentIndex === 0 && step > 0) {
                if (getIndex(1) != null) {
                    currentIndex = 1;
                    step = -1;
                } else
                    break;
            } else {
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
            }
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

function ignorePromiseError(value: any) {
    if (value instanceof Promise)
        value.catch(() => void 0);
}

function accumulateHalvedValues(num: number, times: number) {
    let res = 0;
    let currentNum = num;

    for (let i = 0; i < times; i++) {
        currentNum = Math.floor(currentNum / 2);
        if (currentNum === 0 && num > 0)
            currentNum = 1;
        else if (currentNum === 0 && num < 0)
            currentNum = -1;

        res += currentNum;
    }

    return res;
}
