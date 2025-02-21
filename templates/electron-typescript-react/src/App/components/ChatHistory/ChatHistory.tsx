import {useMemo} from "react";
import classNames from "classnames";
import {LlmState, SimplifiedModelChatItem} from "../../../../electron/state/llmState.ts";
import {UserMessage} from "./components/UserMessage/UserMessage.js";
import {ModelMessage} from "./components/ModelMessage/ModelMessage.js";

import "./ChatHistory.css";


export function ChatHistory({simplifiedChat, generatingResult, className}: ChatHistoryProps) {
    const renderChatItems = useMemo(() => {
        if (simplifiedChat.length > 0 &&
            simplifiedChat.at(-1)!.type !== "model" &&
            generatingResult
        )
            return [...simplifiedChat, emptyModelMessage];

        return simplifiedChat;
    }, [simplifiedChat, generatingResult]);

    return <div className={classNames("appChatHistory", className)}>
        {
            renderChatItems
                .map((item, index) => {
                    if (item.type === "model")
                        return <ModelMessage
                            key={index}
                            modelMessage={item}
                            active={index === renderChatItems.length - 1 && generatingResult}
                        />;
                    else if (item.type === "user")
                        return <UserMessage key={index} message={item} />;

                    return null;
                })
        }
    </div>;
}

type ChatHistoryProps = {
    simplifiedChat: LlmState["chatSession"]["simplifiedChat"],
    generatingResult: boolean,
    className?: string
};

const emptyModelMessage: SimplifiedModelChatItem = {
    type: "model",
    message: []
};
