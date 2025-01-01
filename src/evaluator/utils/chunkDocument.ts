import {LlamaContextSequence} from "../LlamaContext/LlamaContext.js";
import {ChatHistoryItem, Token, Tokenizer} from "../../types.js";
import {LlamaModel} from "../LlamaModel/LlamaModel.js";
import {LlamaText, SpecialTokensText} from "../../utils/LlamaText.js";
import {resolveChatWrapper} from "../../chatWrappers/utils/resolveChatWrapper.js";
import {ControlledEvaluateInputItem} from "../LlamaContext/types.js";
import {safeEventCallback} from "../../utils/safeEventCallback.js";
import {maxRecentDetokenizerTokens} from "../../consts.js";

/**
 * Chunk the given document using a given context sequence to use the chunks for RAG (Retrieval Augmented Generation) embeddings.
 *
 * This chunking method is fast and efficient, and utilizes as much parallelization as your hardware allows.
 *
 * Based on https://github.com/ZeroEntropy-AI/llama-chunk
 * @experimental - this API is experimental and may change or be removed in subsequent releases
 * @hidden
 */
export async function experimentalChunkDocument(options: {
    contextSequence: LlamaContextSequence,
    document: string,

    /**
     * The tokens to use as separators for chunking the document.
     * Passed to the `getSystemPrompt` function to generate the prompt.
     */
    separatorTokens?: Token[],
    getSystemPrompt?(options: {separatorTokens: Token[], tokenizer: Tokenizer, maxChunkSize?: number}): LlamaText | string,

    /**
     * Maximum number of tokens to allow in a chunk.
     *
     * As a chunk size approaches this limit, the higher the probability of a separator token being inserted.
     *
     * Set to `0` to disable this mechanism.
     *
     * Defaults to `500`.
     */
    maxChunkSize?: number,

    /**
     * The alignment curve for the maximum chunk size mechanism.
     *
     * Adjust the value based on the behavior of the model.
     *
     * Play around with values between `1` and `4` to see what works best for you.
     *
     * Set to `1` to disable this mechanism.
     *
     * Defaults to `4`.
     */
    maxChunkSizeAlignmentCurve?: number,

    /**
     * Append the next few tokens (up to `maxTokens`) to the current chunk if their trimmed content
     * matches any of the texts in `trimmedTexts`
     */
    syntaxAlignment?: {
        /**
         * The maximum number of tokens to append to the current chunk if their trimmed content matches any of the texts in `trimmedTexts`.
         *
         * Default: `4`
         */
        maxTokens?: number,

        /**
         * The trimmed texts to match for, to append the token to the current chunk.
         *
         * Default: `["", ".", ";"]`
         */
        trimmedTexts?: string[]
    },

    /**
     * The number of tokens to skip before starting to use the generated separator tokens to split the document.
     */
    skipFirstTokens?: number,

    /**
     * The number of recent probabilities to keep in the trail for normalization.
     *
     * Adjust the value based on the behavior of the model.
     *
     * Defaults to `200`.
     */
    normalizationTrailSize?: number,

    /**
     * Called when a chunk is generated with the tokens that make up the chunk and the separator token used to split the chunk.
     */
    onChunkTokens?(chunkTokens: Token[], usedSeparatorToken: Token): void,

    /**
     * Called when a chunk is generated with the text that makes up the chunk and the separator token used to split the chunk.
     */
    onChunkText?(chunkText: string, usedSeparatorToken: Token): void
}) {
    const {
        contextSequence,
        document,
        separatorTokens = findAppropriateSeparatorTokens(contextSequence.model),
        getSystemPrompt = getDefaultPrompt,
        maxChunkSize = 500,
        maxChunkSizeAlignmentCurve = 4,
        syntaxAlignment: {
            maxTokens: maxSyntaxAlignment = 4,
            trimmedTexts: syntaxAlignmentTrimmedTexts = ["", ".", ";"]
        } = {},
        skipFirstTokens = 3,
        normalizationTrailSize = 100
    } = options;

    const onChunkTokens = safeEventCallback(options.onChunkTokens);
    const onChunkText = safeEventCallback(options.onChunkText);

    if (separatorTokens.length === 0)
        throw new Error("Separator tokens must be provided");

    const chatHistory: ChatHistoryItem[] = [{
        type: "system",
        text: LlamaText(getSystemPrompt({
            separatorTokens,
            tokenizer: contextSequence.model.tokenizer,
            maxChunkSize: maxChunkSize <= 0
                ? undefined
                : maxChunkSize
        })).toJSON()
    }, {
        type: "user",
        text: document
    }, {
        type: "model",
        response: [""]
    }];
    const chatWrapper = resolveChatWrapper(contextSequence.model);
    const {contextText} = chatWrapper.generateContextState({chatHistory});
    const initialContextTokens = contextText.tokenize(contextSequence.model.tokenizer, "trimLeadingSpace");
    const documentTokens = contextSequence.model.tokenize(document, false, "trimLeadingSpace");
    const syntaxAlignmentTrimmedTextsSet = new Set(syntaxAlignmentTrimmedTexts);

    if (initialContextTokens.length + documentTokens.length > contextSequence.context.contextSize)
        throw new Error("The context size is too small to chunk the given document");

    const evaluateInput: ControlledEvaluateInputItem[] = initialContextTokens.slice();
    for (let i = 0; i < documentTokens.length - 1; i++) {
        const token = documentTokens[i]!;
        evaluateInput.push([token, {
            generateNext: {
                probabilitiesList: true
            }
        }]);
    }

    let weight = 1;
    const recentProbabilitiesTrail: number[] = [];

    let chunkStartIndex = 0;
    let lastPushedSeparatorIndex = 0;
    const chunks: Token[][] = [];
    const res: string[] = [];
    function pushSeparatorIndex(separateIndex: number, separatorToken: Token) {
        lastPushedSeparatorIndex = separateIndex;

        if (separateIndex <= chunkStartIndex)
            return;

        let endIndex = separateIndex;
        for (let i = 0; i < maxSyntaxAlignment && documentTokens[endIndex + i] != null; i++) {
            const text = contextSequence.model.detokenize([documentTokens[endIndex + i]!]);
            if (!syntaxAlignmentTrimmedTextsSet.has(text.trim()))
                break;

            endIndex++;
        }

        const chunk = documentTokens.slice(chunkStartIndex, endIndex);
        const text = contextSequence.model.detokenize(
            chunk,
            false,
            documentTokens.slice(chunkStartIndex - maxRecentDetokenizerTokens, chunkStartIndex)
        );
        chunks.push(chunk);
        chunkStartIndex = endIndex;

        onChunkTokens?.(chunk, separatorToken);
        onChunkText?.(text, separatorToken);
        res.push(text);
    }

    await contextSequence.controlledEvaluate(evaluateInput, {
        onTokenResult(inputTokenIndex, result) {
            const i = inputTokenIndex - initialContextTokens.length;
            const nextProbabilities = result?.next?.probabilities;
            const nextDocumentToken = documentTokens[i + 1];

            if (nextProbabilities == null)
                throw new Error("received no result for token " + i);

            const topProbabilityScore = nextProbabilities.entries()
                .next().value?.[1];
            const [usedSeparatorToken, separatorProbability] = separatorTokens
                .filter((token) => token !== nextDocumentToken) // avoid splitting on document tokens
                .map((token) => [token, nextProbabilities.get(token)] as [token: Token, probability: number | undefined])
                .filter((pair): pair is [token: Token, probability: number] => pair[1] != null)
                .reduce(([tokenA, probabilityA], [tokenB, probabilityB]) => {
                    if (probabilityA >= probabilityB)
                        return [tokenA, probabilityA];

                    return [tokenB, probabilityB];
                }, [separatorTokens[0]!, 0]);

            if (topProbabilityScore == null || separatorProbability == null || separatorProbability === 0)
                return;

            // console.log(
            //     i, contextSequence.model.detokenize([documentTokens[i]!]),
            //     Array.from(nextProbabilities.entries()).slice(0, 5)
            //         .map(([token, probability]) => [contextSequence.model.detokenize([token], true), probability])
            // );

            if (separatorProbability >= topProbabilityScore)
                pushSeparatorIndex(i + 1, usedSeparatorToken);
            else if (i > skipFirstTokens) {
                const adjustedProbability = separatorProbability + (weight * (1 - separatorProbability));
                let maxChunkSizeAlignment = 0;
                if (maxChunkSize !== 0 && adjustedProbability < topProbabilityScore) {
                    const leftProbability = 1 - adjustedProbability;
                    const currentChunkSize = Math.max(0, 1 + i - chunkStartIndex);
                    maxChunkSizeAlignment = currentChunkSize === 0
                        ? 0
                        : adjustExponential(
                            leftProbability * Math.min(1, currentChunkSize / maxChunkSize),
                            maxChunkSizeAlignmentCurve <= 0
                                ? 1
                                : maxChunkSizeAlignmentCurve,
                            0.8
                        );

                    if (currentChunkSize === maxChunkSize)
                        maxChunkSizeAlignment = 1;
                }

                if (adjustedProbability + maxChunkSizeAlignment >= topProbabilityScore && adjustedProbability > 0) {
                    pushSeparatorIndex(i + 1, usedSeparatorToken);

                    // update the weight of the current token with the adjusted probability in the trail
                    if (recentProbabilitiesTrail.length > 1) {
                        weight /= recentProbabilitiesTrail.pop()!;
                        recentProbabilitiesTrail.push(adjustedProbability);
                        weight *= adjustedProbability;
                    }
                }
            }

            const nextDocumentTokenProbability = nextDocumentToken == null
                ? undefined
                : nextProbabilities.get(nextDocumentToken);
            if (nextDocumentTokenProbability != null && nextDocumentTokenProbability > 0) {
                recentProbabilitiesTrail.push(nextDocumentTokenProbability);
                weight *= nextDocumentTokenProbability;

                if (recentProbabilitiesTrail.length > normalizationTrailSize)
                    weight /= recentProbabilitiesTrail.shift()!;
            }
        }
    });

    if (lastPushedSeparatorIndex !== documentTokens.length)
        pushSeparatorIndex(documentTokens.length, separatorTokens[0]!);

    return res;
}

const idealTokenTexts = [
    "\u6bb5", // means "section" in Chinese (according to https://github.com/ZeroEntropy-AI/llama-chunk)
    "\u987f", // means "pause" in Chinese (according to Llama 3.1 8B and Qwen 2.5 3B)
    "\u00a1", // inverted exclamation mark
    "|",
    "_"
];
function findAppropriateSeparatorTokens(model: LlamaModel, maxTokens: number = 2): Token[] {
    const idealTextsSet = new Set(idealTokenTexts);
    const foundTokens: Token[] = [];

    for (const token of model.iterateAllTokens()) {
        if (model.isSpecialToken(token))
            continue;

        const text = model.detokenize([token]);
        const trimmedText = text.trim();
        if (idealTextsSet.has(trimmedText)) {
            const textIndex = idealTokenTexts.findIndex((idealText) => idealText === trimmedText);

            if (foundTokens[textIndex] == null || text === trimmedText)
                foundTokens[textIndex] = token;
        }
    }

    const res: Token[] = [];
    for (let i = 0; i < idealTokenTexts.length; i++) {
        const token = foundTokens[i];

        if (token != null)
            res.push(token);
    }

    return res.slice(0, maxTokens);
}

function getDefaultPrompt({
    separatorTokens, tokenizer, maxChunkSize = 500
}: {
    separatorTokens: Token[], tokenizer: Tokenizer, maxChunkSize?: number
}): LlamaText {
    if (separatorTokens.length === 0)
        throw new Error("No separator tokens provided");
    else if (separatorTokens.length > 2)
        throw new Error("Maximum of 2 separator tokens are supported");

    return LlamaText.joinValues("\n", [
        'Your job is to act as a "Chunker", for usage in RAG pipelines. The user will provide a long document.',
        "",
        "You should repeat the exact same message verbatim. EXCEPT, you should insert split tokens throughout the document.",
        "",
        "# Instructions",
        LlamaText([
            "- For splits, use `",
            new SpecialTokensText(tokenizer.detokenize([separatorTokens[0]!])),
            '` as the "big split token" separator.'
        ]),
        separatorTokens.length > 1 && (
            LlamaText([
                "- For small splits, use `",
                new SpecialTokensText(tokenizer.detokenize([separatorTokens[1]!])),
                '` as the "big split token" separator.'
            ])
        ),
        "- For example, in text document, small splits will be per-sentence, and big splits will be per-section. Do a big split BEFORE the header that defines a section.",
        LlamaText([
            "- You may get a user message that is unstructured or not structured cleanly. " +
            "Still try to split that input as best as you can, even if it means doing a small split every ", Math.ceil(maxChunkSize / 5),
            " characters, and a big split every ", Math.floor(maxChunkSize), " characters."
        ]),
        "- You should prefer to wait until the end of a newline or period to break, instead of breaking one or two tokens before that. If there are no newlines or periods, pick some other reasonable breakpoints instead.",
        "- Your input could be anything - code, HTML, markdown, etc. You MUST try to output SOME split regardless of the input. Pick something reasonable! E.g. for nodejs, do a small split after every line or code block, and a big split after every function or class definitions.",
        '- For HTML, add a small split token after every closing tag and sentence. Add a big split token after every closing tag of an "important" tag.',
        "- Please note that you will sometimes not see your own splits in your previous output, that's OK, you MUST continue to try to output split tokens"
    ].filter((x) => x !== false));
}

function adjustExponential(value: number, exponent: number, weight: number) {
    if (value < 0)
        return 0;
    else if (value > 1)
        return 1;

    return (value * (1 - weight)) + (weight * Math.pow(value, exponent));
}
