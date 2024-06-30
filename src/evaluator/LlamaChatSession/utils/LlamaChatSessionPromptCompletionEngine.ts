import {DisposeAggregator, DisposedError} from "lifecycle-utils";
import {Token} from "../../../types.js";
import {getConsoleLogPrefix} from "../../../utils/getConsoleLogPrefix.js";
import {LruCache} from "../../../utils/LruCache.js";
import {safeEventCallback} from "../../../utils/safeEventCallback.js";
import {pushAll} from "../../../utils/pushAll.js";
import type {LLamaChatCompletePromptOptions, LlamaChatSession} from "../LlamaChatSession.js";

export type LLamaChatPromptCompletionEngineOptions = {
    /**
     * Max tokens to allow for preloading a prompt and generating a completion for it.
     *
     * Defaults to `256` or half of the context size, whichever is smaller.
     */
    maxPreloadTokens?: number,
    onGeneration?(prompt: string, completion: string): void,

    /**
     * Max number of completions to cache.
     *
     * Defaults to `100`.
     */
    maxCachedCompletions?: number,

    temperature?: LLamaChatCompletePromptOptions["temperature"],
    minP?: LLamaChatCompletePromptOptions["minP"],
    topK?: LLamaChatCompletePromptOptions["topK"],
    topP?: LLamaChatCompletePromptOptions["topP"],
    trimWhitespaceSuffix?: LLamaChatCompletePromptOptions["trimWhitespaceSuffix"],
    evaluationPriority?: LLamaChatCompletePromptOptions["evaluationPriority"],
    repeatPenalty?: LLamaChatCompletePromptOptions["repeatPenalty"],
    tokenBias?: LLamaChatCompletePromptOptions["tokenBias"],
    customStopTriggers?: LLamaChatCompletePromptOptions["customStopTriggers"],
    grammar?: LLamaChatCompletePromptOptions["grammar"],
    functions?: LLamaChatCompletePromptOptions["functions"],
    documentFunctionParams?: LLamaChatCompletePromptOptions["documentFunctionParams"]
};

const defaultMaxPreloadTokens = 256;
const defaultMaxCachedCompletions = 100;

export class LlamaChatSessionPromptCompletionEngine {
    /** @internal */ private readonly _chatSession: LlamaChatSession;
    /** @internal */ private readonly _maxPreloadTokens: number;
    /** @internal */ private readonly _maxCachedCompletions: number;
    /** @internal */ private readonly _onGeneration?: LLamaChatPromptCompletionEngineOptions["onGeneration"];
    /** @internal */ private readonly _completionOptions: LLamaChatCompletePromptOptions;
    /** @internal */ private readonly _completionCaches = new WeakMap<object, CompletionCache>();
    /** @internal */ private readonly _disposeAggregator = new DisposeAggregator();
    /** @internal */ private _currentCompletionAbortController = new AbortController();
    /** @internal */ private _lastPrompt?: string;
    /** @internal */ private _disposed = false;

    private constructor(chatSession: LlamaChatSession, {
        maxPreloadTokens = defaultMaxPreloadTokens,
        onGeneration,
        maxCachedCompletions = defaultMaxCachedCompletions,
        ...options
    }: LLamaChatPromptCompletionEngineOptions) {
        this._chatSession = chatSession;
        this._maxPreloadTokens = Math.max(1, maxPreloadTokens);
        this._maxCachedCompletions = Math.max(1, maxCachedCompletions);
        this._onGeneration = safeEventCallback(onGeneration);
        this._completionOptions = options;

        this.dispose = this.dispose.bind(this);

        this._disposeAggregator.add(
            this._chatSession.onDispose.createListener(this.dispose)
        );
        this._disposeAggregator.add(() => {
            this._disposed = true;
            this._currentCompletionAbortController.abort();
        });
    }

    public dispose() {
        if (this._disposed)
            return;

        this._disposeAggregator.dispose();
    }

    /**
     * Get completion for the prompt from the cache,
     * and begin preloading this prompt into the context sequence and completing it.
     *
     * On completion progress, `onGeneration` (configured for this engine instance) will be called.
     */
    public complete(prompt: string): string {
        if (this._disposed)
            throw new DisposedError();

        const completionCache = this._getCurrentCompletionCache();

        const completion = completionCache.getCompletion(prompt);

        if (this._lastPrompt == null || !(this._lastPrompt + (completion ?? "")).startsWith(prompt)) {
            this._lastPrompt = prompt;
            this._restartCompletion(completionCache);
        }

        this._lastPrompt = prompt;

        return completion ?? "";
    }

    /** @internal */
    private _getCurrentCompletionCache() {
        const completionCache = this._completionCaches.get(this._chatSession._chatHistoryStateRef);

        if (completionCache != null)
            return completionCache;

        const newCompletionCache = new CompletionCache(this._maxCachedCompletions);
        this._completionCaches.set(this._chatSession._chatHistoryStateRef, newCompletionCache);
        return newCompletionCache;
    }

    /** @internal */
    private _restartCompletion(completionCache: CompletionCache) {
        if (this._disposed)
            return;

        this._currentCompletionAbortController.abort();
        this._currentCompletionAbortController = new AbortController();
        const prompt = this._lastPrompt;

        if (prompt == null)
            return;

        const existingCompletion = completionCache.getCompletion(prompt);
        const promptToComplete = prompt + (existingCompletion ?? "");

        const currentPromptTokens = this._chatSession.model.tokenize(promptToComplete, false, "trimLeadingSpace").length;
        const leftTokens = Math.max(0, this._maxPreloadTokens - currentPromptTokens);

        if (leftTokens === 0)
            return;

        const currentAbortController = this._currentCompletionAbortController;
        const currentAbortSignal = this._currentCompletionAbortController.signal;
        const currentCompletion: Token[] = [];
        void this._chatSession.completePrompt(promptToComplete, {
            ...this._completionOptions,
            stopOnAbortSignal: false,
            maxTokens: leftTokens,
            signal: currentAbortSignal,
            onToken: (chunk) => {
                pushAll(currentCompletion, chunk);
                const completion = (existingCompletion ?? "") + this._chatSession.model.detokenize(currentCompletion);
                completionCache.putCompletion(prompt, completion);

                if (this._getCurrentCompletionCache() !== completionCache) {
                    currentAbortController.abort();
                    return;
                }

                if (this._lastPrompt === prompt)
                    this._onGeneration?.(prompt, completion);
            }
        })
            .then(() => {
                if (this._lastPrompt !== prompt && this._getCurrentCompletionCache() === completionCache)
                    return this._restartCompletion(completionCache);
            })
            .catch((err) => {
                if (currentAbortSignal.aborted && err === currentAbortSignal.reason)
                    return;

                console.error(getConsoleLogPrefix(false, false), err);
            });
    }

    /** @internal */
    public static _create(chatSession: LlamaChatSession, options: LLamaChatPromptCompletionEngineOptions = {}) {
        return new LlamaChatSessionPromptCompletionEngine(chatSession, options);
    }
}

class CompletionCache {
    /** @internal */ private readonly _cache: LruCache<string, null>;
    /** @internal */ private readonly _rootNode: InputNode = [new Map()];

    public constructor(maxInputs: number) {
        this._cache = new LruCache(maxInputs, {
            onDelete: (key) => {
                this._deleteInput(key);
            }
        });
    }

    public get maxInputs() {
        return this._cache.maxSize;
    }

    public getCompletion(input: string): string | null {
        let node: InputNode | undefined = this._rootNode;

        for (let i = 0; i < input.length; i++) {
            if (node == null)
                return null;

            const [next, completion]: InputNode = node;
            const char = input[i];

            if (!next.has(char)) {
                if (completion != null && completion.startsWith(input.slice(i))) {
                    this._cache.get(input.slice(0, i));
                    return completion.slice(input.length - i);
                }
            }

            node = next.get(char);
        }

        if (node == null)
            return null;

        const [, possibleCompletion] = node;
        if (possibleCompletion != null) {
            this._cache.get(input);
            return possibleCompletion;
        }

        return null;
    }

    public putCompletion(input: string, completion: string): string {
        this._cache.set(input, null);

        let node = this._rootNode;
        for (let i = 0; i < input.length; i++) {
            const [next] = node;
            const char = input[i];

            if (!next.has(char))
                next.set(char, [new Map()]);

            node = next.get(char)!;
        }

        const currentCompletion = node[1];
        if (currentCompletion != null && currentCompletion.startsWith(completion))
            return currentCompletion;

        node[1] = completion;
        return completion;
    }

    /** @internal */
    private _deleteInput(input: string) {
        let lastNodeWithMultipleChildren: InputNode = this._rootNode;
        let lastNodeWithMultipleChildrenDeleteChar: string = input[0];

        let node = this._rootNode;
        for (let i = 0; i < input.length; i++) {
            const [next] = node;
            const char = input[i];

            if (next.size > 1) {
                lastNodeWithMultipleChildren = node;
                lastNodeWithMultipleChildrenDeleteChar = char;
            }

            if (!next.has(char))
                return;

            node = next.get(char)!;
        }

        if (lastNodeWithMultipleChildrenDeleteChar !== "")
            lastNodeWithMultipleChildren[0].delete(lastNodeWithMultipleChildrenDeleteChar);
    }
}

type InputNode = [
    next: Map<string, InputNode>,
    completion?: string
];
