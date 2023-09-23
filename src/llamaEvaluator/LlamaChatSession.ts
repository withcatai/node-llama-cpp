import {defaultChatSystemPrompt} from "../config.js";
import {withLock} from "../utils/withLock.js";
import {ChatPromptWrapper} from "../ChatPromptWrapper.js";
import {AbortError} from "../AbortError.js";
import {GeneralChatPromptWrapper} from "../chatWrappers/GeneralChatPromptWrapper.js";
import {getChatWrapperByBos} from "../chatWrappers/createChatWrapperByBos.js";
import {ConversationInteraction, Token} from "../types.js";
import {generateContextTextFromConversationHistory} from "../chatWrappers/generateContextTextFromConversationHistory.js";
import {LlamaModel} from "./LlamaModel.js";
import {LlamaContext} from "./LlamaContext.js";

const UNKNOWN_UNICODE_CHAR = "\ufffd";


export type LlamaChatSessionOptions = {
    context: LlamaContext,
    printLLamaSystemInfo?: boolean,
    promptWrapper?: ChatPromptWrapper | "auto",
    systemPrompt?: string,

    /** Conversation history to load into the context to continue an existing conversation */
    conversationHistory?: readonly ConversationInteraction[]
};

export class LlamaChatSession {
    private readonly _systemPrompt: string;
    private readonly _printLLamaSystemInfo: boolean;
    private readonly _promptWrapper: ChatPromptWrapper;
    private _promptIndex: number = 0;
    private _initialized: boolean = false;
    private _lastStopString: string | null = null;
    private _lastStopStringSuffix: string | null = null;
    private _conversationHistoryToLoad: readonly ConversationInteraction[] | null = null;
    private readonly _ctx: LlamaContext;

    public constructor({
        context,
        printLLamaSystemInfo = false,
        promptWrapper = new GeneralChatPromptWrapper(),
        systemPrompt = defaultChatSystemPrompt,
        conversationHistory
    }: LlamaChatSessionOptions) {
        this._ctx = context;
        this._printLLamaSystemInfo = printLLamaSystemInfo;
        this._systemPrompt = systemPrompt;
        this._conversationHistoryToLoad = (conversationHistory != null && conversationHistory.length > 0)
            ? conversationHistory
            : null;

        if (promptWrapper === "auto") {
            const chatWrapper = getChatWrapperByBos(context.getBosString());

            if (chatWrapper != null)
                this._promptWrapper = new chatWrapper();
            else
                this._promptWrapper = new GeneralChatPromptWrapper();
        } else
            this._promptWrapper = promptWrapper;
    }

    public get initialized() {
        return this._initialized;
    }

    public get context() {
        return this._ctx;
    }

    public async init() {
        await withLock(this, "init", async () => {
            if (this._initialized)
                return;

            if (this._printLLamaSystemInfo)
                console.log("Llama system info", LlamaModel.systemInfo);

            this._initialized = true;
        });
    }

    public async prompt(prompt: string, {
        onToken, signal, maxTokens
    }: { onToken?(tokens: Token[]): void, signal?: AbortSignal, maxTokens?: number } = {}) {
        if (!this.initialized)
            await this.init();

        return await withLock(this, "prompt", async () => {
            let promptText = "";

            if (this._promptIndex == 0 && this._conversationHistoryToLoad != null) {
                const {text, stopString, stopStringSuffix} =
                    generateContextTextFromConversationHistory(this._promptWrapper, this._conversationHistoryToLoad, {
                        systemPrompt: this._systemPrompt,
                        currentPromptIndex: this._promptIndex,
                        lastStopString: this._lastStopString,
                        lastStopStringSuffix: this._promptIndex == 0
                            ? (
                                this._ctx.prependBos
                                    ? this._ctx.getBosString()
                                    : null
                            )
                            : this._lastStopStringSuffix
                    });

                promptText += text;
                this._lastStopString = stopString;
                this._lastStopStringSuffix = stopStringSuffix;
                this._promptIndex += this._conversationHistoryToLoad.length;

                this._conversationHistoryToLoad = null;
            }

            promptText += this._promptWrapper.wrapPrompt(prompt, {
                systemPrompt: this._systemPrompt,
                promptIndex: this._promptIndex,
                lastStopString: this._lastStopString,
                lastStopStringSuffix: this._promptIndex == 0
                    ? (
                        this._ctx.prependBos
                            ? this._ctx.getBosString()
                            : null
                    )
                    : this._lastStopStringSuffix
            });
            this._promptIndex++;
            this._lastStopString = null;
            this._lastStopStringSuffix = null;

            const {text, stopString, stopStringSuffix} =
                await this._evalTokens(this._ctx.encode(promptText), {onToken, signal, maxTokens});
            this._lastStopString = stopString;
            this._lastStopStringSuffix = stopStringSuffix;

            return text;
        });
    }

    private async _evalTokens(tokens: Uint32Array, {
        onToken, signal, maxTokens
    }: { onToken?(tokens: Token[]): void, signal?: AbortSignal, maxTokens?: number } = {}) {
        const stopStrings = this._promptWrapper.getStopStrings();
        const stopStringIndexes: number[] = Array(stopStrings.length).fill(0);
        const skippedChunksQueue: Token[] = [];
        const res: Token[] = [];

        for await (const chunk of this._ctx.evaluate(tokens)) {
            if (signal?.aborted)
                throw new AbortError();

            const tokenStr = this._ctx.decode(Uint32Array.from([chunk]));
            const {
                shouldReturn, skipTokenEvent, stopString, stopStringSuffix
            } = this._checkStopString(tokenStr, stopStrings, stopStringIndexes);

            if (shouldReturn) {
                skippedChunksQueue.push(chunk);
                const skippedChunksText = skippedChunksQueue.length > 0
                    ? this._ctx.decode(Uint32Array.from(skippedChunksQueue))
                    : "";

                const [queuedTextBeforeStopString] = skippedChunksText.split(stopString);

                if (queuedTextBeforeStopString.length > 0) {
                    const beforeStopStringTokens: Token[] = Array.from(this._ctx.encode(queuedTextBeforeStopString));

                    res.push(...beforeStopStringTokens);
                    onToken?.(beforeStopStringTokens);
                    skippedChunksQueue.length = 0;
                }

                return {
                    text: this._ctx.decode(Uint32Array.from(res)),
                    stopString,
                    stopStringSuffix
                };
            }

            // if the token is unknown, it means it's not complete character
            if (tokenStr === UNKNOWN_UNICODE_CHAR || skipTokenEvent) {
                skippedChunksQueue.push(chunk);
                continue;
            }

            if (skippedChunksQueue.length > 0) {
                res.push(...skippedChunksQueue);
                onToken?.(skippedChunksQueue);
                skippedChunksQueue.length = 0;
            }

            res.push(chunk);
            onToken?.([chunk]);

            if (maxTokens != null && maxTokens > 0 && res.length >= maxTokens)
                break;
        }

        return {
            text: this._ctx.decode(Uint32Array.from(res)),
            stopString: null,
            stopStringSuffix: null
        };
    }

    private _checkStopString(tokenStr: string, stopStrings: string[], stopStringIndexes: number[]){
        let skipTokenEvent = false;

        for (let stopStringIndex = 0; stopStringIndex < stopStrings.length; stopStringIndex++) {
            const stopString = stopStrings[stopStringIndex];

            let localShouldSkipTokenEvent = false;
            let i = 0;
            for (; i < tokenStr.length && stopStringIndexes[stopStringIndex] !== stopString.length; i++) {
                if (tokenStr[i] === stopString[stopStringIndexes[stopStringIndex]]) {
                    stopStringIndexes[stopStringIndex]++;
                    localShouldSkipTokenEvent = true;
                } else {
                    stopStringIndexes[stopStringIndex] = 0;
                    localShouldSkipTokenEvent = false;
                }
            }

            if (stopStringIndexes[stopStringIndex] === stopString.length) {
                return {
                    shouldReturn: true,
                    stopString,
                    stopStringSuffix: tokenStr.length === i
                        ? null
                        : tokenStr.slice(i)
                };
            }

            skipTokenEvent ||= localShouldSkipTokenEvent;
        }

        return {skipTokenEvent};
    }
}
