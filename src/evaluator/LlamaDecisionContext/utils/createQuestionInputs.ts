import {LlamaText} from "../../../utils/LlamaText.js";
import {pushAll} from "../../../utils/pushAll.js";
import {findSingleToken, generateCriteriaChoiceOptionTokens} from "./generateCriteriaChoiceOptionTokens.js";
import type {LlamaModel} from "../../../index.js";
import type {Token} from "../../../types.js";
import type {DecisionQuestions} from "../types.js";

export function createQuestionInputs(questions: DecisionQuestions, model: LlamaModel) {
    return Object.fromEntries(
        Object.entries(questions)
            .map(([key, question]) => [key, createQuestionInput(key, question, model)])
    );
}
export type QuestionInput = ReturnType<typeof createQuestionInput>;

function createQuestionInput(keyName: string, question: DecisionQuestions[number], model: LlamaModel) {
    const tokenizer = model.tokenizer;

    if (
        (LlamaText.isLlamaText(question.instruction) && question.instruction.values.length === 0) ||
        (typeof question.instruction === "string" && question.instruction.length === 0) ||
        (question.instruction instanceof Array && question.instruction.length === 0)
    )
        throw new Error(`Question instruction for key "${keyName}" is empty`);

    if (question.type === "noul") {
        const yesToken = findBestToken(["Yes", "True", "Y", "1"], model);
        const noToken = findBestToken(["No", "False", "N", "0"], model);

        if (question.criteria == null)
            return {
                type: "noul" as const,
                tokens: [yesToken, noToken] as const,
                input: [
                    ...LlamaText([
                        "For the following:",
                        question.instruction,
                        "",
                        ""
                    ]).tokenize(tokenizer, "trimLeadingSpace"),

                    ...LlamaText("Reply in ").tokenize(tokenizer, "trimLeadingSpace"),
                    yesToken,
                    ...LlamaText(" or ").tokenize(tokenizer, "trimLeadingSpace"),
                    noToken
                ]
            };

        else
            return {
                type: "noul" as const,
                tokens: [yesToken, noToken] as const,
                input: [
                    ...LlamaText([
                        "For the following:",
                        question.instruction,
                        "",
                        ""
                    ]).tokenize(tokenizer, "trimLeadingSpace"),

                    ...LlamaText("Reply in ").tokenize(tokenizer, "trimLeadingSpace"),
                    yesToken,
                    ...LlamaText(" or ").tokenize(tokenizer, "trimLeadingSpace"),
                    noToken,
                    ...LlamaText(":\n").tokenize(tokenizer, "trimLeadingSpace"),

                    yesToken,
                    ...LlamaText([" criteria: ", question.criteria.true]).tokenize(tokenizer, "trimLeadingSpace"),
                    noToken,
                    ...LlamaText([" criteria: ", question.criteria.false]).tokenize(tokenizer, "trimLeadingSpace")
                ]
            };
    } else if (question.type === "choice") {
        const keys = Object.keys(question.criteria);
        const choiceOptions = generateCriteriaChoiceOptionTokens(keys.length, model);
        if (choiceOptions.length < 2)
            throw new Error('Question with type "choice" must have at least 2 criteria');

        const input: Token[] = [
            ...LlamaText.joinValues("\n", [
                "For the following:",
                question.instruction,
                "",
                "Respond in a single character from:",
                ""
            ]).tokenize(tokenizer, "trimLeadingSpace")
        ];

        for (let i = 0; i < choiceOptions.length; i++) {
            input.push(choiceOptions[i]!);
            pushAll(input, LlamaText([
                ": ", question.criteria[keys[i]!]!,
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
        const scoreOptions = generateCriteriaChoiceOptionTokens(question.criteria.length + additionalChoices, model);
        if (scoreOptions.length - additionalChoices < 2)
            throw new Error('Question with type "score" must have at least 2 criteria');

        const input: Token[] = [
            ...LlamaText.joinValues("\n", [
                "For the following:",
                question.instruction,
                "",
                "Respond in a single character from:",
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

function findBestToken(texts: string[], model: LlamaModel, fallbackIndex: number = -1) {
    for (const text of texts) {
        const token = findSingleToken(text, model);
        if (token != null)
            return token;
    }

    if (fallbackIndex !== -1) {
        try {
            const token = generateCriteriaChoiceOptionTokens(fallbackIndex, model)?.[fallbackIndex];
            if (token != null)
                return token;
        } catch (error) {
            // do nothing
        }
    }

    throw new Error("Unable to find a token for: " + texts[0]);
}

function getAdditionalChoiceOption(index: number) {
    if (index === 0)
        return "None of the above";

    throw new Error(`Unsupported additional choice option index: ${index}`);
}
