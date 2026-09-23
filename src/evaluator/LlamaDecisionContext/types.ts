import type {LlamaText} from "../../utils/LlamaText.js";

export type DecisionQuestion = DecisionNoulQuestion | DecisionChoiceQuestion | DecisionScoreQuestion;
export type DecisionQuestions = {readonly [key: string]: DecisionQuestion};

export type DecisionNoulQuestion = {
    type: "noul",
    instruction: string | LlamaText,
    criteria?: {
        true: string,
        false: string
    }
};
export type DecisionChoiceQuestion = {
    type: "choice",
    instruction: string | LlamaText,
    criteria: {
        [key: string]: string | LlamaText
    }
};
export type DecisionScoreQuestion = {
    type: "score",
    instruction: string | LlamaText,
    criteria: readonly (string | LlamaText)[]
};


export type DecisionAnswer<Question extends DecisionQuestion> =
    Question extends DecisionNoulQuestion
        ? DecisionNoulAnswer
        : Question extends DecisionChoiceQuestion
            ? DecisionChoiceAnswer<Question>
            : Question extends DecisionScoreQuestion
                ? DecisionScoreAnswer<Question>
                : never;
export type DecisionAnswers<Questions extends DecisionQuestions> = {readonly [Key in keyof Questions]: DecisionAnswer<Questions[Key]>};

export type DecisionNoulAnswer = {
    value: number
};
export type DecisionChoiceAnswer<Question extends DecisionChoiceQuestion> = {
    choice: Extract<keyof Question["criteria"], string>,
    confidence: number,
    probabilities: Record<Extract<keyof Question["criteria"], string>, number>
};
export type DecisionScoreAnswer<Question extends DecisionScoreQuestion> = {
    score: number,
    confidence: number,
    probabilities: ToProbabilities<Question["criteria"]>
};

type ToProbabilities<T extends readonly any[]> = {
    -readonly [K in keyof T]: number;
};
