import classNames from "classnames";
import {useCallback, useState} from "react";
import {CopyIconSVG} from "../../../../../icons/CopyIconSVG.js";
import {CheckIconSVG} from "../../../../../icons/CheckIconSVG.js";

import "./MessageCopyButton.css";

const showCopiedTime = 1000 * 2;

export function MessageCopyButton({text}: MessageCopyButtonProps) {
    const [copies, setCopies] = useState(0);

    const onClick = useCallback(() => {
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
    }, [text]);

    return <button
        onClick={onClick}
        className={classNames("copyButton", copies > 0 && "copied")}
    >
        <CopyIconSVG className="icon copy" />
        <CheckIconSVG className="icon check" />
    </button>;
}

type MessageCopyButtonProps = {
    text: string
};
