import {MessageMarkdown} from "../../../MessageMarkdown/MessageMarkdown.js";
import {SimplifiedUserChatItem} from "../../../../../../electron/state/llmState.js";

import "./UserMessage.css";

export function UserMessage({message}: UserMessageProps) {
    return <MessageMarkdown className="message user">
        {message.message}
    </MessageMarkdown>;
}

type UserMessageProps = {
    message: SimplifiedUserChatItem
};
