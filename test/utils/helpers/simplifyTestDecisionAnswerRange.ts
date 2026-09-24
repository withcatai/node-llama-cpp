import {DecisionAnswer, DecisionAnswers} from "../../../src/index.js";

export function simplifyTestDecisionAnswers<const T extends DecisionAnswers<any>>(answers: T): T {
    return Object.fromEntries(
        Object.entries(answers).map(([key, value]) => [key, simplifyTestDecisionAnswerRange(value)])
    ) as T;
}

export function simplifyTestDecisionAnswerRange<const T extends DecisionAnswer<any>>(answer: T): T {
    if (answer.type === "noul")
        return {
            ...answer,
            value: simplifyFloat(answer.value)
        } satisfies typeof answer;
    else if (answer.type === "choice")
        return {
            ...answer,
            confidence: simplifyFloat(answer.confidence),
            probabilities: Object.fromEntries(
                Object.entries(answer.probabilities)
                    .map(([key, value]) => [key, simplifyFloat(value)])
            )
        } satisfies typeof answer;
    else if (answer.type === "score")
        return {
            ...answer,
            confidence: simplifyFloat(answer.confidence),
            score: simplifyFloat(answer.score),
            probabilities: answer.probabilities.map((value) => simplifyFloat(value))
        } satisfies typeof answer;
    else
        void (answer satisfies never);

    throw new Error(`Unsupported answer type: ${(answer as any).type}`);
}

function simplifyFloat(value: number) {
    if (value === 0)
        return 0;

    const step = 10 ** (Math.floor(Math.log10(Math.abs(value))) - 2);
    return Number.parseFloat((Math.round(value / step) * step).toPrecision(12));
}

