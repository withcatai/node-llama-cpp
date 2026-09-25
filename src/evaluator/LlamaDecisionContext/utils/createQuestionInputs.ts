import {LlamaText} from "../../../utils/LlamaText.js";
import {pushAll} from "../../../utils/pushAll.js";
import {generateCriteriaChoiceOptionTokens} from "./generateCriteriaChoiceOptionTokens.js";
import type {Token, Tokenizer} from "../../../types.js";
import type {DecisionQuestions} from "../types.js";

export function createQuestionInputs(questions: DecisionQuestions, tokenizer: Tokenizer) {
    return Object.fromEntries(
        Object.entries(questions)
            .map(([key, question]) => [key, createQuestionInput(key, question, tokenizer)])
    );
}
export type QuestionInput = ReturnType<typeof createQuestionInput>;

function createQuestionInput(keyName: string, question: DecisionQuestions[number], tokenizer: Tokenizer) {
    if (
        (LlamaText.isLlamaText(question.instruction) && question.instruction.values.length === 0) ||
        (typeof question.instruction === "string" && question.instruction.length === 0) ||
        (question.instruction instanceof Array && question.instruction.length === 0)
    )
        throw new Error(`Question instruction for key "${keyName}" is empty`);

    if (question.type === "noul") {
        const [yesToken, noToken] = generateCriteriaChoiceOptionTokens(2, tokenizer);

        if (yesToken == null || noToken == null)
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
            ...LlamaText([": ", yesLabel, "\n"]).tokenize(tokenizer, "trimLeadingSpace"),
            noToken,
            ...LlamaText([": ", noLabel]).tokenize(tokenizer, "trimLeadingSpace")
        ];

        return {
            type: "noul" as const,
            tokens: [yesToken, noToken] as const,
            input
        };
    } else if (question.type === "choice") {
        const keys = Object.keys(question.criteria);
        const choiceOptions = generateCriteriaChoiceOptionTokens(keys.length, tokenizer);
        if (choiceOptions.length < 2)
            throw new Error('Question with type "choice" must have at least 2 criteria');

        const input: Token[] = [
            ...LlamaText.joinValues("\n", [
                ["Question: ", question.instruction],
                "",
                "Reply the letter of the best answer:",
                ""
            ]).tokenize(tokenizer, "trimLeadingSpace")
        ];

        for (let i = 0; i < choiceOptions.length; i++) {
            input.push(choiceOptions[i]!);
            const criteriaKey = keys[i]!;

            pushAll(input, LlamaText([
                ": ", question.criteria[criteriaKey] ?? criteriaKey,
                i === choiceOptions.length - 1
                    ? ""
                    : "\n"
            ]).tokenize(tokenizer, "trimLeadingSpace"));
        }

        return {
            type: "choice" as const,
            tokens: choiceOptions,
            keys,
            input
        };
    } else if (question.type === "score") {
        const additionalChoices = 1;
        const scoreOptions = generateCriteriaChoiceOptionTokens(question.criteria.length + additionalChoices, tokenizer);
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
                ": ", text,
                i === scoreOptions.length - 1
                    ? ""
                    : "\n"
            ]).tokenize(tokenizer, "trimLeadingSpace"));
        }

        return {
            type: "score" as const,
            tokens: scoreOptions,
            input
        };
    } else
        void (question satisfies never);

    throw new Error(`Unsupported question type: ${(question as any).type}`);
}

function getAdditionalChoiceOption(index: number) {
    if (index === 0)
        return "None of the above";

    throw new Error(`Unsupported additional choice option index: ${index}`);
}
