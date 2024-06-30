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
