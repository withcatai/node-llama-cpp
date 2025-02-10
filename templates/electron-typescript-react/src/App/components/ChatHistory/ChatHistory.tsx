import {LlmState, SimplifiedModelChatItem} from "../../../../electron/state/llmState.ts";
import {UserMessage} from "./components/UserMessage/UserMessage.js";
import {ModelMessage} from "./components/ModelMessage/ModelMessage.js";

import "./ChatHistory.css";


export function ChatHistory({simplifiedChat, generatingResult}: ChatHistoryProps) {
    return <div className="appChatHistory">
        {
            simplifiedChat.map((item, index) => {
                if (item.type === "model")
                    return <ModelMessage
                        key={index}
                        modelMessage={item}
                        active={index === simplifiedChat.length - 1 && generatingResult}
                    />;
                else if (item.type === "user")
                    return <UserMessage key={index} message={item} />;

                return null;
            })
        }
        {
            (
                simplifiedChat.length > 0 &&
                simplifiedChat[simplifiedChat.length - 1]!.type !== "model" &&
                generatingResult
            ) &&
            <ModelMessage modelMessage={emptyModelMessage} active />
        }
    </div>;
}

type ChatHistoryProps = {
    simplifiedChat: LlmState["chatSession"]["simplifiedChat"],
    generatingResult: boolean
};

const emptyModelMessage: SimplifiedModelChatItem = {
    type: "model",
    message: []
};
