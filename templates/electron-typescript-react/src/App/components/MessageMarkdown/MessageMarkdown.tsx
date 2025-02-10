import classNames from "classnames";
import {MarkdownContent} from "../MarkdownContent/MarkdownContent.js";

import "./MessageMarkdown.css";


export function MessageMarkdown({children, className}: MessageMarkdownProps) {
    return <MarkdownContent className={classNames("appMessageMarkdown", className)}>
        {children}
    </MarkdownContent>;
}

type MessageMarkdownProps = {
    children: string,
    className?: string
};
