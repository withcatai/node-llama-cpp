import {useLayoutEffect, useRef} from "react";
import markdownit from "markdown-it";
import hljs from "highlight.js";

import "./MarkdownContent.css";

const md = markdownit({
    highlight(str, lang): string {
        if (hljs.getLanguage(lang) != null) {
            try {
                return hljs.highlight(str, {language: lang}).value;
            } catch (err) {
                // do nothing
            }
        }

        return hljs.highlightAuto(str).value;
    }
});

export function MarkdownContent({children, className}: MarkdownContentProps) {
    const divRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (divRef.current == null)
            return;

        divRef.current.innerHTML = md.render(children ?? "");
    }, [children]);

    return <div
        className={className}
        ref={divRef}
    />;
}

type MarkdownContentProps = {
    className?: string,
    children: string
};
