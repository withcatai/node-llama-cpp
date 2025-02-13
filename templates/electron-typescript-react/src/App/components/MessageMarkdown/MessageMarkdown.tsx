import classNames from "classnames";
import {MarkdownContent} from "../MarkdownContent/MarkdownContent.js";

import "./MessageMarkdown.css";


export function MessageMarkdown({children, activeDot = false, className}: MessageMarkdownProps) {
    return <MarkdownContent className={classNames("appMessageMarkdown", activeDot && "active", className)}>
        {children ?? ""}
    </MarkdownContent>;
}

type MessageMarkdownProps = {
    children?: string,
    activeDot?: boolean,
    className?: string
};
