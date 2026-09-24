import type {Token, Tokenizer} from "../../../types.js";
import type {DecisionAnswer, DecisionChoiceAnswer, DecisionNoulAnswer, DecisionScoreAnswer} from "../types.js";
import type {QuestionInput} from "./createQuestionInputs.js";

export const decisionAnswerMinimumTopLogits = 20;
export function createDecisionAnswer(input: QuestionInput, rawLogits: Map<Token, number>, tokenizer: Tokenizer): DecisionAnswer<any> {
    const logits = getNormalizedInputTokenLogits(input, rawLogits, tokenizer);

    if (input.type === "noul") {
        const [yesToken, noToken] = input.tokens;
        const yesLogit = logits.get(yesToken);
        const noLogit = logits.get(noToken);

        if (yesLogit == null || noLogit == null)
            throw new Error("Failed to retrieve yes/no scores");

        const diff = yesLogit - noLogit;
        if (diff >= 0)
            return {
                type: "noul",
                value: 1 / (1 + Math.exp(-diff))
            } satisfies DecisionNoulAnswer;

        const weight = Math.exp(diff);
        return {
            type: "noul",
            value: weight / (1 + weight)
        } satisfies DecisionNoulAnswer;
    } else if (input.type === "choice") {
        let maxLogit: number | null = null;
        let maxToken: Token | null = null;
        let secondMaxLogit: number | null = null;

        for (const token of input.tokens) {
            const logit = logits.get(token) ?? 0;

            if (maxLogit === null || logit > maxLogit) {
                secondMaxLogit = maxLogit;
                maxLogit = logit;
                maxToken = token;
            } else if (secondMaxLogit === null || logit > secondMaxLogit)
                secondMaxLogit = logit;
        }

        const probabilities: Record<string, number> = {};
        for (const key of input.keys)
            probabilities[key] = 0;

        let totalWeight = 0;
        let choice: string | null = null;
        for (let i = 0; i < input.tokens.length; i++) {
            const token = input.tokens[i]!;
            const key = input.keys[i]!;

            const logit = logits.get(token) ?? 0;
            const weight = Math.exp(logit - (maxLogit ?? 0));

            probabilities[key] = weight;
            totalWeight += weight;

            if (token === maxToken)
                choice = key;
        }

        for (const key of input.keys)
            probabilities[key]! /= totalWeight;

        if (choice == null)
            throw new Error("Unable to determine choice");

        return {
            type: "choice",
            choice,
            confidence: -Math.expm1((secondMaxLogit ?? 0) - (maxLogit ?? 0)) / totalWeight,
            probabilities
        } satisfies DecisionChoiceAnswer<any>;
    } else if (input.type === "score") {
        const additionalChoices = 1;
        const levels = input.tokens.length - additionalChoices;

        let maxLogit: number | null = null;
        for (let i = 0; i < levels; i++) {
            const token = input.tokens[i]!;
            const logit = logits.get(token) ?? 0;

            if (maxLogit === null || logit > maxLogit)
                maxLogit = logit;
        }

        const probabilities: number[] = [];
        let totalWeight = 0;
        for (let i = 0; i < levels; i++) {
            const token = input.tokens[i]!;
            const logit = logits.get(token) ?? 0;
            const weight = Math.exp(logit - (maxLogit ?? 0));

            probabilities.push(weight);
            totalWeight += weight;
        }

        let score = 0;
        let highestProbability: number | null = null;
        for (let i = 0; i < probabilities.length; i++) {
            const prob = probabilities[i]! / totalWeight;
            probabilities[i]! = prob;

            if (highestProbability == null || prob > highestProbability)
                highestProbability = prob;

            score += probabilities[i]! * i;
        }

        const noneDiff = (logits.get(input.tokens[levels]!) ?? 0) - (maxLogit ?? 0) - Math.log(totalWeight);
        const noneWeight = Math.exp(-Math.abs(noneDiff));
        const noneProbability = noneDiff >= 0
            ? 1 / (1 + noneWeight)
            : noneWeight / (1 + noneWeight);

        return {
            type: "score",
            score,
            confidence: 1 - noneProbability,
            probabilities
        } satisfies DecisionScoreAnswer<any>;
    } else
        void (input satisfies never);

    throw new Error(`Unsupported input type: ${(input as any).type}`);
}

export function createEmptyInvalidDecisionAnswer(input: QuestionInput): DecisionAnswer<any> {
    if (input.type === "noul")
        return {
            type: "noul",
            value: 0
        } satisfies DecisionNoulAnswer;
    else if (input.type === "choice")
        return {
            type: "choice",
            choice: "",
            confidence: 0,
            probabilities: {}
        } satisfies DecisionChoiceAnswer<any>;
    else if (input.type === "score")
        return {
            type: "score",
            score: 0,
            confidence: 0,
            probabilities: []
        } satisfies DecisionScoreAnswer<any>;
    else
        void (input satisfies never);

    throw new Error(`Unsupported input type: ${(input as any).type}`);
}

function getNormalizedInputTokenLogits(input: QuestionInput, logits: Map<Token, number>, tokenizer: Tokenizer) {
    const res = new Map<Token, number>();
    const textToLogit = new Map<string, number>();

    for (const [token, logit] of logits.entries()) {
        const text = tokenizer.detokenize([token], false).trim();
        if (text.length !== 1)
            continue;

        textToLogit.set(text, logit);
    }

    for (const token of input.tokens) {
        const logit = logits.get(token) ?? 0;
        res.set(token, logit);

        const text = tokenizer.detokenize([token], false).trim();
        if (text.length !== 1)
            continue;

        const destinationLogit = textToLogit.get(text);
        if (destinationLogit != null && destinationLogit > logit)
            res.set(token, destinationLogit);
    }

    return res;
}
