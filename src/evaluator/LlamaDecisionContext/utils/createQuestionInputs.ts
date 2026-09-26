import {LlamaText} from "../../../utils/LlamaText.js";
import {pushAll} from "../../../utils/pushAll.js";
import {generateCriteriaChoiceOptionTokens} from "./generateCriteriaChoiceOptionTokens.js";
import type {Token, Tokenizer} from "../../../types.js";
import type {DecisionQuestions} from "../types.js";

const maxScoreLevels = 10;
const maxChoiceOptions = 256;

export function createQuestionInputs(questions: DecisionQuestions, tokenizer: Tokenizer) {
    return Object.fromEntries(
        Object.entries(questions)
            .map(([key, question]) => [key, createQuestionInput(key, question, tokenizer)])
    );
}

function createQuestionInput(keyName: string, question: DecisionQuestions[number], tokenizer: Tokenizer): QuestionInput {
    if (
        (LlamaText.isLlamaText(question.instruction) && question.instruction.values.length === 0) ||
        (typeof question.instruction === "string" && question.instruction.length === 0) ||
        (question.instruction instanceof Array && question.instruction.length === 0)
    )
        throw new Error(`Question instruction for key "${keyName}" is empty`);

    if (question.type === "noul") {
        const [noToken, yesToken] = generateCriteriaChoiceOptionTokens(2, 2, tokenizer);

        if (noToken == null || yesToken == null)
            throw new Error("Failed to generate yes/no choice option tokens");

        let yesLabel: string = (question.criteria == null || question.criteria.true == null || question.criteria.true.trim() === "")
            ? ""
            : question.criteria.true ?? "";
        let noLabel: string = (question.criteria == null || question.criteria.false == null || question.criteria.false.trim() === "")
            ? ""
            : question.criteria.false ?? "";

        if (yesLabel === "") {
            yesLabel = "Yes";

            if (noLabel === "")
                noLabel = "No";
            else
                noLabel = "No. " + noLabel;
        } else if (noLabel === "") {
            noLabel = "No";
            yesLabel = "Yes. " + yesLabel;
        }

        const input: Token[] = [
            ...LlamaText.joinValues("\n", [
                ["Question: ", question.instruction],
                "",
                "Reply the letter of the best answer:",
                ""
            ]).tokenize(tokenizer, "trimLeadingSpace"),
            yesToken,
            ...LlamaText([". ", yesLabel, "\n"]).tokenize(tokenizer, "trimLeadingSpace"),
            noToken,
            ...LlamaText([". ", noLabel]).tokenize(tokenizer, "trimLeadingSpace")
        ];

        return {
            type: "noul",
            tokens: [yesToken, noToken] as const,
            input
        } satisfies NoulQuestionInput;
    } else if (question.type === "choice") {
        const keys = Object.keys(question.criteria);

        if (keys.length > maxChoiceOptions)
            throw new Error(`Question with type "choice" cannot have more than ${maxChoiceOptions} criteria`);

        const choiceOptions = generateCriteriaChoiceOptionTokens(2, keys.length, tokenizer);
        if (choiceOptions.length < 2)
            throw new Error('Question with type "choice" must have at least 2 criteria');

        const input: Token[] = [
            ...LlamaText.joinValues("\n", [
                ["Question: ", question.instruction],
                "",
                "Reply the letters of the best answer:",
                ""
            ]).tokenize(tokenizer, "trimLeadingSpace")
        ];

        let nesting = 1;
        while (Math.pow(choiceOptions.length, nesting) < keys.length)
            nesting++;

        const answerPrefix = (nesting === 1 || choiceOptions[0] == null)
            ? []
            : [choiceOptions[0]];

        let nestedInputs: number = 0;
        let keyIndex: number = 0;
        const addAnswerTokens = (answerTokens: Map<Token, FunnelInput>, nestingLeft: number, tokenTrail: Token[] = []) => {
            for (let i = 0; i < choiceOptions.length && keyIndex < keys.length; i++) {
                const token = choiceOptions[i]!;

                if (nestingLeft !== 1) {
                    const nestedAnswerTokens = new Map<Token, FunnelInput>();
                    tokenTrail.push(token);
                    addAnswerTokens(nestedAnswerTokens, nestingLeft - 1, tokenTrail);
                    tokenTrail.pop();

                    if (nestedAnswerTokens.size > 0) {
                        answerTokens.set(token, {
                            type: "input",
                            answerTokens: nestedAnswerTokens
                        });
                        nestedInputs++;
                    }
                } else {
                    const criteriaKey = keys[keyIndex]!;

                    pushAll(input, tokenTrail);
                    input.push(token);
                    pushAll(input, LlamaText([
                        ". ", question.criteria[criteriaKey] ?? criteriaKey,
                        keyIndex === keys.length - 1
                            ? ""
                            : "\n"
                    ]).tokenize(tokenizer, "trimLeadingSpace"));

                    answerTokens.set(choiceOptions[i]!, {
                        type: "result",
                        value: criteriaKey
                    });
                    keyIndex++;
                }
            }
        };

        const answerTokens = new Map<Token, FunnelInput>();
        addAnswerTokens(answerTokens, nesting, [...answerPrefix]);

        return {
            type: "choice",
            answerPrefix,
            keys,
            nesting,
            answerTokens,
            input,
            nestedInputs
        } satisfies ChoiceQuestionInput;
    } else if (question.type === "score") {
        if (question.criteria.length > maxScoreLevels)
            throw new Error(`Question with type "score" cannot have more than ${maxScoreLevels} criteria`);

        const additionalChoices = 1;
        const requiredOptions = question.criteria.length + additionalChoices;
        const scoreOptions = generateCriteriaChoiceOptionTokens(requiredOptions, requiredOptions, tokenizer, "?-!@");
        if (scoreOptions.length - additionalChoices < 2)
            throw new Error('Question with type "score" must have at least 2 criteria');

        const input: Token[] = [
            ...LlamaText.joinValues("\n", [
                ["Question: ", question.instruction],
                "",
                "Reply the letter of the best answer:",
                ""
            ]).tokenize(tokenizer, "trimLeadingSpace")
        ];

        for (let i = 0; i < scoreOptions.length; i++) {
            input.push(scoreOptions[i]!);

            const text = i < scoreOptions.length - additionalChoices
                ? question.criteria[i]!
                : getAdditionalChoiceOption(i - (scoreOptions.length - additionalChoices));
            pushAll(input, LlamaText([
                ". ", text,
                i === scoreOptions.length - 1
                    ? ""
                    : "\n"
            ]).tokenize(tokenizer, "trimLeadingSpace"));
        }

        return {
            type: "score" as const,
            tokens: scoreOptions,
            input
        } satisfies ScoreQuestionInput;
    } else
        void (question satisfies never);

    throw new Error(`Unsupported question type: ${(question as any).type}`);
}

function getAdditionalChoiceOption(index: number) {
    if (index === 0)
        return "None of the above";

    throw new Error(`Unsupported additional choice option index: ${index}`);
}

export function getQuestionInputMaxTokenLength(input: QuestionInput): number {
    if (input.type === "noul" || input.type === "score")
        return input.input.length;
    else if (input.type === "choice")
        return input.input.length + input.answerPrefix.length + input.nesting;
    else
        void (input satisfies never);

    throw new Error(`Unsupported question input type: ${(input as any).type}`);
}

export type QuestionInput = NoulQuestionInput | ScoreQuestionInput | ChoiceQuestionInput;

export type NoulQuestionInput = {
    type: "noul",
    tokens: [yes: Token, no: Token],
    input: Token[]
};

export type ScoreQuestionInput = {
    type: "score",
    tokens: Token[],
    input: Token[]
};

export type ChoiceQuestionInput = {
    type: "choice",
    answerPrefix: Token[],
    keys: string[],
    input: Token[],
    nesting: number,
    answerTokens: Map<Token, FunnelInput>,
    nestedInputs: number
};

export type FunnelInput = {
    type: "result",
    value: string
} | {
    type: "input",
    answerTokens: Map<Token, FunnelInput>
};
