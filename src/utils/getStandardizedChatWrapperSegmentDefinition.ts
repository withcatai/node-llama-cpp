import {ChatModelSegmentType, ChatWrapperSettings} from "../types.js";
import {LlamaText} from "./LlamaText.js";

export function getStandardizedChatWrapperSegmentDefinition(
    chatWrapperSetting: ChatWrapperSettings,
    segmentType: ChatModelSegmentType
): StandardizedChatWrapperSettingsSegment | undefined {
    if (segmentType === "thought") {
        const thoughtSegment = chatWrapperSetting.segments?.thought;
        if (typeof thoughtSegment?.prefix === "object" && !LlamaText.isLlamaText(thoughtSegment.prefix) && thoughtSegment.prefix.type != null)
            return {
                ...thoughtSegment,
                prefix: undefined
            };

        return thoughtSegment as StandardizedChatWrapperSettingsSegment;
    } else if (segmentType === "comment")
        return chatWrapperSetting.segments?.comment;

    void (segmentType satisfies never);
    return undefined;
}

export type StandardizedChatWrapperSettingsSegment = {
    readonly prefix?: string | LlamaText,
    readonly suffix?: string | LlamaText
};
