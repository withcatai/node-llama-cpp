import classNames from "classnames";
import {useCallback, useMemo, useState} from "react";
import {MessageMarkdown} from "../../../MessageMarkdown/MessageMarkdown.js";
import {RightChevronIconSVG} from "../../../../../icons/RightChevronIconSVG.js";
import {MarkdownContent} from "../../../MarkdownContent/MarkdownContent.js";

import "./ModelResponseComment.css";

const excerptLength = 1024;

export function ModelResponseComment({text, active}: ModelResponseCommentProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleIsOpen = useCallback(() => {
        setIsOpen((isOpen) => !isOpen);
    }, []);

    const title = useMemo(() => {
        if (active)
            return "Generating comment";

        return "Generated comment";
    }, [active]);

    return <div className={classNames("responseComment", active && "active", isOpen && "open")}>
        <div className="header">
            <button className="opener" onClick={toggleIsOpen}>
                <span className="summary">
                    <div className="title">{title}</div>
                    <RightChevronIconSVG className="chevron" />

                </span>
            </button>
            <MarkdownContent
                className={classNames("excerpt", isOpen && "hide")}
                dir="auto"
                inline
            >
                {text.slice(-excerptLength)}
            </MarkdownContent>
        </div>
        <div className={classNames("comment", !isOpen && "hide")}>
            <MessageMarkdown className="content" activeDot={active}>{text}</MessageMarkdown>
        </div>
    </div>;
}

type ModelResponseCommentProps = {
    text: string,
    active: boolean
};
