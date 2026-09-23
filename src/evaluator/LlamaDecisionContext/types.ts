import type {LlamaText} from "../../utils/LlamaText.js";

export type LlamaQuestion = LlamaNoulQuestion | LlamaChoiceQuestion | LlamaScoreQuestion;
export type LlamaQuestions = {readonly [key: string]: LlamaQuestion};

export type LlamaNoulQuestion = {
    type: "noul",
    instruction: string | LlamaText,
    criteria?: {
        true: string,
        false: string
    }
};
export type LlamaChoiceQuestion = {
    type: "choice",
    instruction: string | LlamaText,
    criteria: {
        [key: string]: string | LlamaText
    }
};
export type LlamaScoreQuestion = {
    type: "score",
    instruction: string | LlamaText,
    criteria: readonly (string | LlamaText)[]
};


export type LlamaDecision<Question extends LlamaQuestion> =
    Question extends LlamaNoulQuestion
        ? LlamaNoulDecision
        : Question extends LlamaChoiceQuestion
            ? LlamaChoiceDecision<Question>
            : Question extends LlamaScoreQuestion
                ? LlamaScoreDecision<Question>
                : never;
export type LlamaDecisions<Questions extends LlamaQuestions> = {readonly [Key in keyof Questions]: LlamaDecision<Questions[Key]>};

export type LlamaNoulDecision = {
    value: number
};
export type LlamaChoiceDecision<Question extends LlamaChoiceQuestion> = {
    choice: Extract<keyof Question["criteria"], string>,
    confidence: number,
    probabilities: Record<Extract<keyof Question["criteria"], string>, number>
};
export type LlamaScoreDecision<Question extends LlamaScoreQuestion> = {
    score: number,
    confidence: number,
    probabilities: ToProbabilities<Question["criteria"]>
};

type ToProbabilities<T extends readonly any[]> = {
    -readonly [K in keyof T]: number;
};
