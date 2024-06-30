import classNames from "classnames";
import {LlmState} from "../../../../electron/state/llmState.ts";
import {MarkdownContent} from "../MarkdownContent/MarkdownContent.js";

import "./ChatHistory.css";


export function ChatHistory({simplifiedChat, generatingResult}: ChatHistoryProps) {
    return <div className="appChatHistory">
        {
            simplifiedChat.map((item, index) => {
                if (item.type === "model") {
                    const isActive = index === simplifiedChat.length - 1 && generatingResult;
                    return <MarkdownContent key={index} className={classNames("message", "model", isActive && "active")}>
                        {item.message}
                    </MarkdownContent>;

                } else if (item.type === "user")
                    return <MarkdownContent key={index} className="message user">
                        {item.message}
                    </MarkdownContent>;

                return null;
            })
        }
        {
            (
                simplifiedChat.length > 0 &&
                simplifiedChat[simplifiedChat.length - 1].type !== "model" &&
                generatingResult
            ) &&
            <div className="message model active"/>
        }
    </div>;
}

type ChatHistoryProps = {
    simplifiedChat: LlmState["chatSession"]["simplifiedChat"],
    generatingResult: boolean
};
