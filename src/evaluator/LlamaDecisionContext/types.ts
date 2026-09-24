import type {LlamaText} from "../../utils/LlamaText.js";

/**
 * @see [Using Structured Decisions](https://node-llama-cpp.withcat.ai/guide/structured-decisions) tutorial
 */
export type DecisionQuestion = DecisionNoulQuestion | DecisionChoiceQuestion | DecisionScoreQuestion;

/**
 * @see [Using Structured Decisions](https://node-llama-cpp.withcat.ai/guide/structured-decisions) tutorial
 */
export type DecisionQuestions = {readonly [key: string]: DecisionQuestion};

/**
 * A question that can be answered with a yes or no.
 * @see [Using Structured Decisions](https://node-llama-cpp.withcat.ai/guide/structured-decisions#noul) tutorial
 */
export type DecisionNoulQuestion = {
    type: "noul",

    /**
     * The instruction describing how to answer the question.
     *
     * For example, `Did we talk about an animal in this chat?`.
     */
    instruction: string | LlamaText,

    /**
     * Optional description of the criteria for whether the answer is true or false.
     * @example
     * ```ts
     * {
     *     true: "The chat mentioned an animal",
     *     false: "The chat did not mention an animal"
     * }
     * ```
     */
    criteria?: {
        true: string,
        false: string
    }
};

/**
 * A question that can be answered by selecting one option from a predefined set of choices.
 * @see [Using Structured Decisions](https://node-llama-cpp.withcat.ai/guide/structured-decisions#choice) tutorial
 */
export type DecisionChoiceQuestion = {
    type: "choice",

    /**
     * The instruction describing how to answer the question.
     *
     * For example, `Which animal was mentioned in the chat?`.
     */
    instruction: string | LlamaText,

    /**
     * The options the model can choose from
     *
     * Each key represents a choice, and the value is a description of that choice.
     * You can set `null` for a choice to reuse its key as the description.
     * @example
     * ```ts
     * {
     *     llama: "Llama",
     *     cat: "Cat",
     *     dog: "Dog",
     *     else: "Something else"
     * }
     * ```
     */
    criteria: {
        [key: string]: string | LlamaText | null
    }
};

/**
 * A question that can be answered by rating the input on a given scale.
 * @see [Using Structured Decisions](https://node-llama-cpp.withcat.ai/guide/structured-decisions#score) tutorial
 */
export type DecisionScoreQuestion = {
    type: "score",

    /**
     * The instruction describing how to answer the question.
     *
     * For example, `How severe is this issue?`.
     */
    instruction: string | LlamaText,

    /**
     * The criteria describing the possible levels for the score.
     * @example
     * ```ts
     * [
     *     "Cosmetic, no impact on functionality",
     *     "Broken, but there are workarounds",
     *     "Blocking, no workaround available"
     * ]
     * ```
     */
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
    type: "noul",

    /**
     * A number between `0` and `1` representing the probability of the answer being yes.
     *
     * `1` means yes, and `0` means no.
     * Values near `0.5` indicate uncertainty between yes and no.
     */
    value: number
};
export type DecisionChoiceAnswer<Question extends DecisionChoiceQuestion> = {
    type: "choice",

    /** The selected choice from the given options */
    choice: Extract<keyof Question["criteria"], string>,

    /** A number between `0` and `1` representing the model's confidence in the selected choice */
    confidence: number,

    /** A record mapping each choice to its probability, with values between `0` and `1` */
    probabilities: Record<Extract<keyof Question["criteria"], string>, number>
};
export type DecisionScoreAnswer<Question extends DecisionScoreQuestion> = {
    type: "score",

    /**
     * The score assigned to the input based on the given criteria.
     *
     * Will be a number from `0` to the maximum defined level index in the criteria array.
     */
    score: number,

    /**
     * The model's confidence in the assigned score, represented as a number between `0` and `1`.
     */
    confidence: number,

    /**
     * The probabilities assigned to each possible score level, represented as numbers between `0` and `1`.
     */
    probabilities: ToProbabilities<Question["criteria"]>
};

type ToProbabilities<T extends readonly any[]> = {
    -readonly [K in keyof T]: number;
};
