import {ChatPromptWrapper} from "../ChatPromptWrapper.js";
import {defaultChatSystemPrompt} from "../config.js";
import {ConversationInteraction} from "../types.js";


/**
 * Generate context text to load into a model context from a conversation history.
 * @param {ChatPromptWrapper} chatPromptWrapper
 * @param {ConversationInteraction[]} conversationHistory
 * @param {object} [options]
 * @param {string} [options.systemPrompt]
 * @param {number} [options.currentPromptIndex]
 * @param {string | null} [options.lastStopString]
 * @param {string | null} [options.lastStopStringSuffix]
 * @returns {{text: string, stopString: (string | null), stopStringSuffix: (string | null)}}
 */
export function generateContextTextFromConversationHistory(
    chatPromptWrapper: ChatPromptWrapper,
    conversationHistory: readonly ConversationInteraction[],
    {
        systemPrompt = defaultChatSystemPrompt, currentPromptIndex = 0, lastStopString = null, lastStopStringSuffix = null
    }: {
        systemPrompt?: string, currentPromptIndex?: number, lastStopString?: string | null, lastStopStringSuffix?: string | null
    } = {}
): {
    text: string;
    stopString: string | null;
    stopStringSuffix: string | null;
} {
    let res = "";

    for (let i = 0; i < conversationHistory.length; i++) {
        const interaction = conversationHistory[i];
        const wrappedPrompt = chatPromptWrapper.wrapPrompt(interaction.prompt, {
            systemPrompt,
            promptIndex: currentPromptIndex,
            lastStopString,
            lastStopStringSuffix
        });
        const stopStrings = chatPromptWrapper.getStopStrings();
        const defaultStopString = chatPromptWrapper.getDefaultStopString();
        const stopStringsToCheckInResponse = new Set([...stopStrings, defaultStopString]);

        currentPromptIndex++;
        lastStopString = null;
        lastStopStringSuffix = null;

        res += wrappedPrompt;

        for (const stopString of stopStringsToCheckInResponse) {
            if (interaction.response.includes(stopString)) {
                console.error(
                    `Stop string "${stopString}" was found in model response of conversation interaction index ${i}`,
                    {interaction, stopString}
                );
                throw new Error("A stop string cannot be in a conversation history interaction model response");
            }
        }

        res += interaction.response;
        res += defaultStopString;
        lastStopString = defaultStopString;
        lastStopStringSuffix = "";
    }

    return {
        text: res,
        stopString: lastStopString,
        stopStringSuffix: lastStopStringSuffix
    };
}
