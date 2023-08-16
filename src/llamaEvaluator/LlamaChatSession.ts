import {defaultChatSystemPrompt} from "../config.js";
import {withLock} from "../utils/withLock.js";
import {ChatPromptWrapper} from "../ChatPromptWrapper.js";
import {AbortError} from "../AbortError.js";
import {GeneralChatPromptWrapper} from "../chatWrappers/GeneralChatPromptWrapper.js";
import {LlamaModel} from "./LlamaModel.js";
import {LlamaContext} from "./LlamaContext.js";

const UNKNOWN_UNICODE_CHAR = "�";

export class LlamaChatSession {
    private readonly _systemPrompt: string;
    private readonly _printLLamaSystemInfo: boolean;
    private readonly _promptWrapper: ChatPromptWrapper;
    private _promptIndex: number = 0;
    private _initialized: boolean = false;
    private readonly _ctx: LlamaContext;

    public constructor({
        context,
        printLLamaSystemInfo = false,
        promptWrapper = new GeneralChatPromptWrapper(),
        systemPrompt = defaultChatSystemPrompt
    }: {
        context: LlamaContext,
        printLLamaSystemInfo?: boolean,
        promptWrapper?: ChatPromptWrapper,
        systemPrompt?: string,
    }) {
        this._ctx = context;
        this._printLLamaSystemInfo = printLLamaSystemInfo;
        this._promptWrapper = promptWrapper;

        this._systemPrompt = systemPrompt;
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

    public async prompt(prompt: string, onToken?: (tokens: number[]) => void, {signal}: { signal?: AbortSignal } = {}) {
        if (!this.initialized)
            await this.init();

        return await withLock(this, "prompt", async () => {
            const promptText = this._promptWrapper.wrapPrompt(prompt, {systemPrompt: this._systemPrompt, promptIndex: this._promptIndex});
            this._promptIndex++;

            return await this._evalTokens(this._ctx.encode(promptText), onToken, {signal});
        });
    }

    private async _evalTokens(tokens: Uint32Array, onToken?: (tokens: number[]) => void, {signal}: { signal?: AbortSignal } = {}) {
        const decodeTokens = (tokens: number[]) => this._ctx.decode(Uint32Array.from(tokens));

        const stopStrings = this._promptWrapper.getStopStrings();
        const stopStringIndexes = Array(stopStrings.length).fill(0);
        const skippedChunksQueue: number[] = [];
        const res: number[] = [];


        for await (const chunk of this._ctx.evaluate(tokens)) {
            if (signal?.aborted)
                throw new AbortError();

            const tokenStr = decodeTokens([chunk]);
            const {shouldReturn, skipTokenEvent} = this._checkStopString(tokenStr, stopStringIndexes);

            if (shouldReturn)
                return decodeTokens(res);

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
        }

        return decodeTokens(res);
    }

    private _checkStopString(tokenStr: string, stopStringIndexes: number[]){
        const stopStrings = this._promptWrapper.getStopStrings();
        let skipTokenEvent = false;

        for (let stopStringIndex = 0; stopStringIndex < stopStrings.length; stopStringIndex++) {
            const stopString = stopStrings[stopStringIndex];

            let localShouldSkipTokenEvent = false;
            for (let i = 0; i < tokenStr.length && stopStringIndexes[stopStringIndex] !== stopString.length; i++) {
                if (tokenStr[i] === stopString[stopStringIndexes[stopStringIndex]]) {
                    stopStringIndexes[stopStringIndex]++;
                    localShouldSkipTokenEvent = true;
                } else {
                    stopStringIndexes[stopStringIndex] = 0;
                    localShouldSkipTokenEvent = false;
                    break;
                }
            }

            if (stopStringIndexes[stopStringIndex] === stopString.length) {
                return {shouldReturn: true};
            }

            skipTokenEvent ||= localShouldSkipTokenEvent;
        }

        return {skipTokenEvent};
    }
}
