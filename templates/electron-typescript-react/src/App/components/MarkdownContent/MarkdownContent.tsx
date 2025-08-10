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

export function MarkdownContent({children, inline = false, dir, className}: MarkdownContentProps) {
    const divRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (divRef.current == null)
            return;

        if (inline)
            divRef.current.innerHTML = md.renderInline(children ?? "").replaceAll("<br>", "");
        else
            divRef.current.innerHTML = md.render(children ?? "");
    }, [inline, children]);

    return <div
        className={className}
        ref={divRef}
        dir={dir}
    />;
}

type MarkdownContentProps = {
    className?: string,
    inline?: boolean,
    dir?: string,
    children: string
};
