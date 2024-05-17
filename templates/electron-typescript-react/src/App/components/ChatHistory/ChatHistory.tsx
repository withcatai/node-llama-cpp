import classNames from "classnames";
import {LlmState} from "../../../../electron/state/llmState.ts";

import "./ChatHistory.css";


export function ChatHistory({simplifiedChat, generatingResult}: ChatHistoryProps) {
    return <div className="appChatHistory">
        {
            simplifiedChat.map((item, index) => {
                if (item.type === "model") {
                    const isActive = index === simplifiedChat.length - 1 && generatingResult;
                    return <div key={index} className={classNames("message", "model", isActive && "active")}>
                        {item.message}
                    </div>;

                } else if (item.type === "user")
                    return <div key={index} className="message user">
                        {item.message}
                    </div>;

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
