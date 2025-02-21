import classNames from "classnames";
import {useCallback, useMemo, useState} from "react";
import prettyMilliseconds from "pretty-ms";
import {MessageMarkdown} from "../../../MessageMarkdown/MessageMarkdown.js";
import {RightChevronIconSVG} from "../../../../../icons/RightChevronIconSVG.js";
import {MarkdownContent} from "../../../MarkdownContent/MarkdownContent.js";

import "./ModelResponseThought.css";

const excerptLength = 1024;

export function ModelResponseThought({text, active, duration}: ModelResponseThoughtProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleIsOpen = useCallback(() => {
        setIsOpen((isOpen) => !isOpen);
    }, []);

    const title = useMemo(() => {
        if (active)
            return "Thinking";
        else if (duration != null) {
            const formattedDuration = prettyMilliseconds(duration, {
                secondsDecimalDigits: duration < 1000 * 10 ? 2 : 0,
                verbose: true
            });
            return `Thought for ${formattedDuration}`;
        }

        return "Finished thinking";
    }, [active, duration]);

    return <div className={classNames("responseThought", active && "active", isOpen && "open")}>
        <button className="header" onClick={toggleIsOpen}>
            <span className="summary">
                <div className="title">{title}</div>
                <RightChevronIconSVG className="chevron" />
            </span>
            <MarkdownContent
                className={classNames("excerpt", isOpen && "hide")}
                dir="auto"
                inline
            >
                {text.slice(-excerptLength)}
            </MarkdownContent>
        </button>
        <MessageMarkdown className={classNames("content", !isOpen && "hide")} activeDot={active}>{text}</MessageMarkdown>
    </div>;
}

type ModelResponseThoughtProps = {
    text: string,
    active: boolean,
    duration?: number
};
