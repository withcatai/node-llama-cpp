import classNames from "classnames";
import {useCallback, useState} from "react";
import {CopyIconSVG} from "../../../../../../../icons/CopyIconSVG.js";
import {CheckIconSVG} from "../../../../../../../icons/CheckIconSVG.js";
import {SimplifiedModelChatItem} from "../../../../../../../../electron/state/llmState.js";

import "./ModelMessageCopyButton.css";

const showCopiedTime = 1000 * 2;

export function ModelMessageCopyButton({modelMessage}: ModelMessageCopyButtonProps) {
    const [copies, setCopies] = useState(0);

    const onClick = useCallback(() => {
        const text = modelMessage
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n")
            .trim();

        navigator.clipboard.writeText(text)
            .then(() => {
                setCopies(copies + 1);

                setTimeout(() => {
                    setCopies(copies - 1);
                }, showCopiedTime);
            })
            .catch((error) => {
                console.error("Failed to copy text to clipboard", error);
            });
    }, [modelMessage]);

    return <button
        onClick={onClick}
        className={classNames("copyButton", copies > 0 && "copied")}
    >
        <CopyIconSVG className="icon copy" />
        <CheckIconSVG className="icon check" />
    </button>;
}

type ModelMessageCopyButtonProps = {
    modelMessage: SimplifiedModelChatItem["message"]
};
