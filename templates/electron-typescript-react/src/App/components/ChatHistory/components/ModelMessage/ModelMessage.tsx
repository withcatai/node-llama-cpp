import {MessageMarkdown} from "../../../MessageMarkdown/MessageMarkdown.js";
import {SimplifiedModelChatItem} from "../../../../../../electron/state/llmState.js";
import {ModelResponseThought} from "../ModelResponseThought/ModelResponseThought.js";
import {ModelResponseComment} from "../ModelResponseComment/ModelResponseComment.js";
import {ModelMessageCopyButton} from "./components/ModelMessageCopyButton/ModelMessageCopyButton.js";

import "./ModelMessage.css";

export function ModelMessage({modelMessage, active}: ModelMessageProps) {
    return <div className="message model">
        {
            modelMessage.message.map((message, responseIndex) => {
                const isLastMessage = responseIndex === modelMessage.message.length - 1;

                if (message.type === "segment") {
                    if (message.segmentType === "thought")
                        return <ModelResponseThought
                            key={responseIndex}
                            text={message.text}
                            active={isLastMessage && active}
                            duration={
                                (message.startTime != null && message.endTime != null)
                                    ? (new Date(message.endTime).getTime() - new Date(message.startTime).getTime())
                                    : undefined
                            }
                        />;
                    else if (message.segmentType === "comment")
                        return <ModelResponseComment
                            key={responseIndex}
                            text={message.text}
                            active={isLastMessage && active}
                        />;
                    else
                        // ensure we handle all segment types or TypeScript will complain
                        void (message.segmentType satisfies never);
                }

                return <MessageMarkdown
                    key={responseIndex}
                    activeDot={isLastMessage && active}
                    className="text"
                >
                    {message.text}
                </MessageMarkdown>;
            })
        }
        {
            (modelMessage.message.length === 0 && active) &&
            <MessageMarkdown className="text" activeDot />
        }
        <div className="buttons" inert={active}>
            <ModelMessageCopyButton modelMessage={modelMessage.message} />
        </div>
    </div>;
}

type ModelMessageProps = {
    modelMessage: SimplifiedModelChatItem,
    active: boolean
};
