import {AbortablePromise, AsyncQueue, scopeExit} from "lifecycle-utils";
import {internalCheckpoints, LlamaContextSequence} from "../../LlamaContext/LlamaContext.js";
import {Token} from "../../../types.js";
import {ControlledEvaluateInputItem, EvaluationPriority} from "../../LlamaContext/types.js";
import {TokenMeter} from "../../TokenMeter.js";
import {pushAll} from "../../../utils/pushAll.js";
import type {ChoiceQuestionInput, FunnelInput} from "./createQuestionInputs.js";
import type {DecisionChoiceAnswer} from "../types.js";

export async function evaluateChoiceDecision({
    question,
    seqQueue: localQueue,
    signal,
    evaluationPriority,

    baseSeqTokens
}: {
    question: ChoiceQuestionInput,
    seqQueue: AsyncQueue<LlamaContextSequence>,
    signal?: AbortSignal,
    evaluationPriority?: EvaluationPriority,

    baseSeqTokens: Token[]
}) {
    const localSeqs = new Set<LlamaContextSequence>();
    let evaluationsLeft = question.nestedInputs;
    let inputTokens: number = 0;
    let outputTokens: number = 0;
    using localQueueScopeHandle = scopeExit(() => {
        if (localQueue.parent == null)
            return;

        localQueue.forwardPushesToParent = true;
        localQueue.drainToParent();
    });

    const scores: Record<string, number> = {};
    const probabilities: Record<string, number> = {};
    let maxScore: number | null = null;
    let maxScoreKey: string | null = null;
    let secondMaxScore: number | null = null;
    for (const key of question.keys)
        probabilities[key] = 0;

    using mainSeqLease = await localQueue.acquire(signal);
    const mainSeqMeterInitialSnapshot = mainSeqLease.item.tokenMeter.getState();

    const needPrefixSeqs = new Map<LlamaContextSequence, [accept: (value?: Promise<void>) => void, reject: (reason?: any) => void]>();
    using fixSeqsQueueHandle = scopeExit(() => {
        for (const [, [, reject]] of needPrefixSeqs) {
            reject(new Error("Disposed"));
        }
        needPrefixSeqs.clear();
    });

    async function fixPendingSeqs(seq: LlamaContextSequence) {
        if (needPrefixSeqs.size === 0)
            return;

        const entriesNeedFixing = [...needPrefixSeqs.entries()];
        needPrefixSeqs.clear();
        await Promise.all(
            entriesNeedFixing
                .map(async ([otherSeq, [accept, reject]]) => {
                    try {
                        const copied = await otherSeq._copyStateFromOtherSequence(seq, baseSeqTokens.length);
                        if (!copied)
                            accept(
                                otherSeq.adaptStateToTokens(baseSeqTokens, false)
                                    .then(() => (
                                        otherSeq.evaluateWithoutGeneratingNewTokens(baseSeqTokens.slice(otherSeq.nextTokenIndex))
                                    ))
                                    .then(() => void 0)
                            );
                        else
                            accept();
                    } catch (err) {
                        reject(err);
                    }
                })
        );
    }

    async function preloadSeqs(seqToCopyFrom: LlamaContextSequence, maxPreloadCount: number) {
        const seqsToPreload: LlamaContextSequence[] = [];
        for (let i = 0; i < maxPreloadCount; i++) {
            const seq = localQueue.tryShift();

            if (seq == null)
                break;

            seqsToPreload.push(seq);
        }
        using putBackInQueueHandle = scopeExit(() => {
            for (const seq of seqsToPreload)
                localQueue.push(seq);

            seqsToPreload.length = 0;
        });

        const preloadResults = await Promise.allSettled(
            seqsToPreload
                .filter((preloadSeq) => !localSeqs.has(preloadSeq))
                .map(async (preloadSeq) => {
                    const initialMeterSnapshot = preloadSeq.tokenMeter.getState();
                    using updateTokenUsageExitHandle = scopeExit(() => {
                        const diff = TokenMeter.diff(preloadSeq.tokenMeter.getState(), initialMeterSnapshot);
                        inputTokens += diff.usedInputTokens;
                        outputTokens += diff.usedOutputTokens;
                    });

                    const copied = await preloadSeq._copyStateFromOtherSequence(seqToCopyFrom, baseSeqTokens.length);
                    if (!copied) {
                        signal?.throwIfAborted();
                        await preloadSeq.adaptStateToTokens(baseSeqTokens, false);
                        await preloadSeq.evaluateWithoutGeneratingNewTokens(baseSeqTokens.slice(preloadSeq.nextTokenIndex));
                    }

                    localSeqs.add(preloadSeq);
                })
        );
        signal?.throwIfAborted();

        for (const result of preloadResults) {
            if (result.status === "rejected")
                throw result.reason;
        }
    }

    async function evaluateFunnel(answerTokens: Map<Token, FunnelInput>, evaluateInput: Token[], trailScore: number) {
        let logits: Map<Token, number>;
        {
            using seqLease = await localQueue.acquire(signal);
            const seq = seqLease.item;

            using drainToParentOnFinishHandle = scopeExit(() => {
                evaluationsLeft--;
                if (evaluationsLeft > 0 || localQueue.parent == null)
                    return;

                localQueue.forwardPushesToParent = true;
                localQueue.drainToParent();
            });

            const initialMeterSnapshot = seq.tokenMeter.getState();
            using updateTokenUsageExitHandle = scopeExit(() => {
                const diff = TokenMeter.diff(seq.tokenMeter.getState(), initialMeterSnapshot);
                inputTokens += diff.usedInputTokens;
                outputTokens += diff.usedOutputTokens;
            });

            if (!localSeqs.has(seq)) {
                await new AbortablePromise<void>(signal, (accept, reject) => {
                    needPrefixSeqs.set(seq, [accept, reject]);

                    return () => {
                        needPrefixSeqs.delete(seq);
                    };
                });
                localSeqs.add(seq);
            }

            await using exitHandle = scopeExit(() => fixPendingSeqs(seq));
            if (needPrefixSeqs.size != 0) {
                await fixPendingSeqs(seq);
                signal?.throwIfAborted();
            }

            if (evaluateInput.length === 0)
                throw new Error("Evaluate input is empty");

            if (seq.nextTokenIndex > baseSeqTokens.length) {
                let firstDifferentIndex = baseSeqTokens.length;
                for (let i = 0; i < evaluateInput.length - 1; i++) {
                    if (seq.contextTokens[baseSeqTokens.length + i] !== evaluateInput[i])
                        break;

                    firstDifferentIndex = baseSeqTokens.length + i + 1;
                }

                if (firstDifferentIndex == seq.nextTokenIndex) {
                    evaluateInput = evaluateInput.slice(firstDifferentIndex - baseSeqTokens.length);
                } else {
                    evaluateInput = [...baseSeqTokens, ...evaluateInput];
                    const lastToken = evaluateInput.pop();

                    await seq.adaptStateToTokens(evaluateInput, false);
                    evaluateInput = evaluateInput.slice(seq.nextTokenIndex);

                    if (lastToken != null)
                        evaluateInput.push(lastToken);

                    signal?.throwIfAborted();
                }
            }

            const controlledEvaluateInput: ControlledEvaluateInputItem[] = [...evaluateInput];
            controlledEvaluateInput[controlledEvaluateInput.length - 1] = [
                controlledEvaluateInput[controlledEvaluateInput.length - 1] as Token,
                {
                    generateNext: {
                        logits: {
                            filter: {
                                tokens: [...answerTokens.keys()]
                            }
                        }
                    }
                }
            ];

            const res = await seq.controlledEvaluate(controlledEvaluateInput, {evaluationPriority});
            const lastTokenResult = res[res.length - 1];
            if (lastTokenResult == null || lastTokenResult.next?.logits == null)
                throw new Error("Failed to generate decisions");

            logits = lastTokenResult.next.logits;

            let totalInputFunnels = 0;
            for (const funnel of answerTokens.values()) {
                if (funnel.type === "input")
                    totalInputFunnels++;
            }
            if (totalInputFunnels !== 0)
                await preloadSeqs(seq, totalInputFunnels);
        }

        await handleEvaluationResult(answerTokens, evaluateInput, trailScore, logits);
    }

    async function handleEvaluationResult(
        answerTokens: Map<Token, FunnelInput>,
        evaluateInput: Token[],
        trailScore: number,
        logits: Map<Token, number>
    ) {
        let maxLogit: number | null = null;
        for (const token of answerTokens.keys()) {
            const logit = logits.get(token);

            if (logit == null)
                throw new Error("Failed to get logit for token: " + token);

            if (maxLogit === null || logit > maxLogit)
                maxLogit = logit;
        }

        let totalLogitWeight = 0;
        for (const token of answerTokens.keys()) {
            const logit = logits.get(token);

            if (logit == null)
                throw new Error("Failed to get logit for token: " + token);

            totalLogitWeight += Math.exp(logit - (maxLogit ?? 0));
        }

        const logSumExp = (maxLogit ?? 0) + Math.log(totalLogitWeight);

        const allSettledResults = await Promise.allSettled(
            [...answerTokens.entries()].map(async ([token, funnel]) => {
                const logit = logits.get(token);

                if (logit == null)
                    throw new Error("Failed to get logit for token: " + token);

                const tokenScore = logit - logSumExp;
                const score = trailScore + tokenScore;

                if (funnel.type === "result") {
                    const existingValue = scores[funnel.value];
                    if (existingValue == null)
                        scores[funnel.value] = score;
                    else
                        scores[funnel.value] = Math.max(score, existingValue);

                    if (maxScore == null || score > maxScore) {
                        secondMaxScore = maxScore;
                        maxScore = score;
                        maxScoreKey = funnel.value;
                    } else if (secondMaxScore == null || score > secondMaxScore)
                        secondMaxScore = score;
                } else if (funnel.type === "input")
                    await evaluateFunnel(funnel.answerTokens, [...evaluateInput, token], score);
                else
                    void (funnel satisfies never);
            })
        );

        for (const result of allSettledResults) {
            if (result.status === "rejected")
                throw result.reason;
        }
    }


    await mainSeqLease.item.adaptStateToTokens(baseSeqTokens, false);
    const controlledEvaluateInput: ControlledEvaluateInputItem[] = baseSeqTokens.slice(mainSeqLease.item.nextTokenIndex);
    if (controlledEvaluateInput.length === 0) {
        await mainSeqLease.item.eraseContextTokenRanges([{start: baseSeqTokens.length - 1, end: mainSeqLease.item.nextTokenIndex}]);
        pushAll(controlledEvaluateInput, baseSeqTokens.slice(mainSeqLease.item.nextTokenIndex));
    }

    if (controlledEvaluateInput.length === 0)
        throw new Error("Evaluate input is empty");

    controlledEvaluateInput[controlledEvaluateInput.length - 1] = [
        controlledEvaluateInput[controlledEvaluateInput.length - 1] as Token,
        {
            generateNext: {
                logits: {
                    filter: {
                        tokens: [...question.answerTokens.keys()]
                    }
                }
            }
        }
    ];

    const res = await mainSeqLease.item.controlledEvaluate(controlledEvaluateInput, {evaluationPriority});
    const lastTokenResult = res[res.length - 1];
    if (lastTokenResult == null || lastTokenResult.next?.logits == null)
        throw new Error("Failed to generate decisions");

    signal?.throwIfAborted();

    if (question.nesting !== 1)
        await mainSeqLease.item._takeNamedCheckpoint(
            internalCheckpoints.choiceDecision.name,
            internalCheckpoints.choiceDecision.maxCheckpoints
        );

    let totalInputFunnels = 0;
    for (const funnel of question.answerTokens.values()) {
        if (funnel.type === "input")
            totalInputFunnels++;
    }
    if (totalInputFunnels !== 0)
        await preloadSeqs(mainSeqLease.item, totalInputFunnels);

    signal?.throwIfAborted();

    const mainSeqLeaseTokenUsageDiff = TokenMeter.diff(mainSeqLease.item.tokenMeter.getState(), mainSeqMeterInitialSnapshot);
    inputTokens += mainSeqLeaseTokenUsageDiff.usedInputTokens;
    outputTokens += mainSeqLeaseTokenUsageDiff.usedOutputTokens;

    localSeqs.add(mainSeqLease.item);
    mainSeqLease.dispose();

    await handleEvaluationResult(question.answerTokens, [], 0, lastTokenResult.next.logits);
    signal?.throwIfAborted();

    let totalScoreWeight = 0;
    for (const [key, score] of Object.entries(scores)) {
        const weight = Math.exp(score - (maxScore ?? 0));
        totalScoreWeight += weight;
        probabilities[key] = weight;
    }

    for (const key of Object.keys(scores))
        probabilities[key]! /= totalScoreWeight;

    if (maxScoreKey == null)
        throw new Error("Failed to determine the choice decision");

    return {
        answer: {
            type: "choice",
            choice: maxScoreKey,
            confidence: Math.tanh(((maxScore ?? 0) - (secondMaxScore ?? 0)) / 2),
            probabilities
        } satisfies DecisionChoiceAnswer<any>,
        tokenUsage: {
            input: inputTokens,
            output: outputTokens
        }
    };
}
