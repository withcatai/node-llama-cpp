import {ChatModelSegmentType, ChatWrapperSettings, ChatWrapperSettingsSegment} from "../types.js";

export function getChatWrapperSegmentDefinition(
    chatWrapperSetting: ChatWrapperSettings,
    segmentType: ChatModelSegmentType
): ChatWrapperSettingsSegment | undefined {
    if (segmentType === "thought")
        return chatWrapperSetting.segments?.thought;
    else if (segmentType === "comment")
        return chatWrapperSetting.segments?.comment;

    void (segmentType satisfies never);
    return undefined;
}
