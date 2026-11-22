import {
    ChatHistoryItem, ChatModelFunctionCallPrefill, ChatModelFunctionCallReady, ChatModelResponse
} from "../types.js";

export type PendingFunctionCall = ChatModelFunctionCallPrefill | ChatModelFunctionCallReady;

/** A pending function call is an instruction to continue or dispatch, not a historical function result. */
export function getFunctionCallPrefill(history: readonly ChatHistoryItem[]): PendingFunctionCall | undefined {
    const lastMessage = history.at(-1);
    const lastResponse = lastMessage?.type === "model" ? lastMessage.response.at(-1) : undefined;
    const pendingCall = lastResponse != null && typeof lastResponse !== "string" && lastResponse.type === "functionCall" &&
        lastResponse.ended !== undefined ? lastResponse : undefined;

    for (let i = 0; i < history.length; i++) {
        const message = history[i];
        if (message?.type !== "model")
            continue;

        for (let j = 0; j < message.response.length; j++) {
            const item = message.response[j];
            if (item != null && typeof item !== "string" && item.type === "functionCall" && item.ended !== undefined &&
                (i !== history.length - 1 || j !== message.response.length - 1)
            )
                throw new Error("An unfinished or ready-to-execute function call must be the last model response item");
        }
    }

    return pendingCall;
}

/** Remove the input prefill before the existing function-call generation/execution loop appends the resolved call. */
export function withoutFunctionCallPrefill(history: readonly ChatHistoryItem[]): ChatHistoryItem[] {
    if (getFunctionCallPrefill(history) == null)
        return history.slice();

    const lastMessage = history.at(-1) as ChatModelResponse;
    return [
        ...history.slice(0, -1),
        {...lastMessage, response: lastMessage.response.slice(0, -1)}
    ];
}

/** Keep the unfinished call last even when an earlier parallel call has just finished executing. */
export function addResolvedFunctionCallBeforePrefill(
    response: ChatModelResponse["response"], resolvedCall: ChatModelResponse["response"][number]
) {
    const last = response.at(-1);
    if (last != null && typeof last !== "string" && last.type === "functionCall" && last.ended !== undefined)
        response.splice(response.length - 1, 0, resolvedCall);
    else
        response.push(resolvedCall);
}
