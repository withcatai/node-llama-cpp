import {Token, Tokenizer} from "../types.js";
import {SpecialToken, isLlamaText, LlamaText, SpecialTokensText} from "./LlamaText.js";
import {QueuedTokenRelease, QueuedTokenReleaseLock} from "./TokenStreamRegulator.js";

export type StopGenerationTrigger = (string | Token)[];

export class StopGenerationDetector<T extends string = string> {
    /** @internal */ private _stopTriggers = new Map<string | Token, TriggerPart<T>>();
    /** @internal */ private _activeChecks = new Set<TriggerCheck<T>>();
    /** @internal */ private _triggeredStops = new Map<TriggerPart<T>, {
        remainingGenerations: Set<string | Token[]>,
        queuedTokenReleaseLocks: Set<QueuedTokenReleaseLock>
    }>();

    public recordGeneration({text, tokens, queuedTokenRelease, startNewChecks = true}: {
        text: string, tokens: Token[], queuedTokenRelease?: QueuedTokenRelease, startNewChecks?: boolean
    }) {
        const currentActiveChecks = this._activeChecks;
        this._activeChecks = new Set();

        for (const check of currentActiveChecks) {
            let lockUsed = false;

            if (text.length > 0)
                lockUsed ||= this._checkTriggerPart(check, text);
            else {
                this._activeChecks.add(check);
                lockUsed = true;
            }

            if (tokens.length > 0)
                lockUsed ||= this._checkTriggerPart(check, tokens);
            else {
                this._activeChecks.add(check);
                lockUsed = true;
            }

            if (!lockUsed)
                check.queuedTokenReleaseLock?.dispose();
        }

        if (!startNewChecks)
            return;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const currentPart = this._stopTriggers.get(char);

            if (currentPart == null)
                continue;

            const textCheck: TriggerCheck<T> = {
                queuedTokenReleaseLock: queuedTokenRelease?.createTextIndexLock(i),
                currentPart
            };
            const lockUsed = this._checkTriggerPart(textCheck, text.slice(i + 1));

            if (!lockUsed)
                textCheck.queuedTokenReleaseLock?.dispose();
        }

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const currentPart = this._stopTriggers.get(token);

            if (currentPart == null)
                continue;

            const tokenCheck: TriggerCheck<T> = {
                queuedTokenReleaseLock: queuedTokenRelease?.createTokenIndexLock(i),
                currentPart
            };
            const lockUsed =  this._checkTriggerPart(tokenCheck, tokens.slice(i + 1));

            if (!lockUsed)
                tokenCheck.queuedTokenReleaseLock?.dispose();
        }
    }

    public addStopTrigger(stopTrigger: StopGenerationTrigger, completeEvent?: T): this {
        const simplifiedTrigger = simplifyStopTrigger(stopTrigger);
        const triggerValues = simplifiedTrigger
            .map((item) => {
                if (typeof item === "string")
                    return item.split("");
                else
                    return [item];
            })
            .flat(1);

        let currentMap = this._stopTriggers;

        for (let i = 0; i < triggerValues.length; i++) {
            const value = triggerValues[i];
            const isLast = i === triggerValues.length - 1;

            if (!currentMap.has(value)) {
                currentMap.set(value, {
                    next: new Map()
                });
            }

            const part = currentMap.get(value)!;
            if (isLast) {
                part.next = undefined;
                part.completesTrigger = simplifiedTrigger;
                part.completeEvents = part.completeEvents ?? new Set();

                if (completeEvent != null)
                    part.completeEvents.add(completeEvent);
            } else if (part.next == null)
                break;
            else
                currentMap = part.next;
        }

        return this;
    }

    /** Whether there are some stops that have been found and triggered. */
    public get hasTriggeredStops() {
        return this._triggeredStops.size > 0;
    }

    /** Whether there are some stops that have been found, but not triggered yet. */
    public get hasInProgressStops() {
        return this._activeChecks.size > 0;
    }

    /** Gets the stops that have been found and triggered. */
    public getTriggeredStops() {
        const res: Array<{
            stopTrigger: StopGenerationTrigger,
            events: T[],
            remainingGenerations: (string | Token[])[],
            queuedTokenReleaseLocks: QueuedTokenReleaseLock[]
        }> = [];

        for (const [triggerPart, triggeredStop] of this._triggeredStops.entries()) {
            res.push({
                stopTrigger: triggerPart.completesTrigger!,
                events: Array.from(triggerPart.completeEvents ?? new Set()),
                remainingGenerations: Array.from(triggeredStop.remainingGenerations),
                queuedTokenReleaseLocks: Array.from(triggeredStop.queuedTokenReleaseLocks)
            });
        }

        return res;
    }

    public clearTriggeredStops() {
        for (const triggeredStop of this._triggeredStops.values()) {
            for (const queuedTokenReleaseLock of triggeredStop.queuedTokenReleaseLocks)
                queuedTokenReleaseLock.dispose();
        }

        this._triggeredStops.clear();
    }

    public clearInProgressStops() {
        for (const check of this._activeChecks)
            check.queuedTokenReleaseLock?.dispose();

        this._activeChecks.clear();
    }

    /** @internal */
    private _addFoundStop(
        part: TriggerPart<T>,
        remainingGeneration?: string | Token[],
        queuedTokenReleaseLock?: QueuedTokenReleaseLock
    ) {
        if (!this._triggeredStops.has(part))
            this._triggeredStops.set(part, {
                remainingGenerations: new Set(),
                queuedTokenReleaseLocks: new Set()
            });

        const triggeredStop = this._triggeredStops.get(part)!;

        if (remainingGeneration != null)
            triggeredStop.remainingGenerations.add(remainingGeneration);

        if (queuedTokenReleaseLock != null)
            triggeredStop.queuedTokenReleaseLocks.add(queuedTokenReleaseLock);
    }

    /** @internal */
    private _checkTriggerPart(check: TriggerCheck<T> | undefined, value: string | Token[]) {
        if (check == null)
            return false;

        let part: TriggerPart<T> | undefined = check.currentPart;

        for (let i = 0; i < value.length && part != null; i++) {
            const item = value[i];

            if (part.next == null) {
                this._addFoundStop(part, value.slice(i), check.queuedTokenReleaseLock);
                return true;
            }

            if (part.next.has(item)) {
                part = part.next.get(item);
                continue;
            }

            return false;
        }

        if (part == null)
            return false;

        if (part.next == null) {
            this._addFoundStop(part, undefined, check.queuedTokenReleaseLock);
            return true;
        } else {
            this._activeChecks.add({
                ...check,
                currentPart: part
            });
            return true;
        }
    }

    public static resolveStopTriggers(
        stopTriggers: readonly (StopGenerationTrigger | LlamaText)[],
        tokenizer: Tokenizer
    ) {
        return stopTriggers.map((stopTrigger) => {
            if (isLlamaText(stopTrigger))
                return StopGenerationDetector.resolveLlamaTextTrigger(stopTrigger, tokenizer);
            else
                return simplifyStopTrigger(stopTrigger);
        });
    }

    public static resolveLlamaTextTrigger(
        llamaText: LlamaText,
        tokenizer: Tokenizer
    ): StopGenerationTrigger {
        return simplifyStopTrigger(
            llamaText.values
                .filter(value => value !== "")
                .map((value) => {
                    if (typeof value === "string")
                        return [value];
                    else if (value instanceof SpecialToken)
                        return value.tokenize(tokenizer);
                    else if (value instanceof SpecialTokensText)
                        return value.tokenize(tokenizer);

                    return value satisfies never;
                })
                .flat(1)
        );
    }
}

function simplifyStopTrigger(stopTrigger: StopGenerationTrigger): StopGenerationTrigger {
    let text = "";
    const res: StopGenerationTrigger = [];

    for (const item of stopTrigger) {
        if (typeof item === "string") {
            text += item;
            continue;
        }

        if (text !== "") {
            res.push(text);
            text = "";
        }

        res.push(item);
    }

    if (text !== "")
        res.push(text);

    return res;
}

type TriggerCheck<T extends string = string> = {
    currentPart: TriggerPart<T>,
    queuedTokenReleaseLock?: QueuedTokenReleaseLock
};

type TriggerPart<T extends string = string> = {
    next?: Map<string | Token, TriggerPart<T>>,
    completesTrigger?: StopGenerationTrigger,
    completeEvents?: Set<T>
};
