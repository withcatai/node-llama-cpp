import React, {useLayoutEffect, useRef} from "react";
import classNames from "classnames";

export function FixedDivWithSpacer({className, ...props}: FixedDivWithSpacerProps) {
    const spacerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (spacerRef.current == null)
            return;

        const spacerTag = spacerRef.current;
        const mainTag = spacerTag.previousElementSibling as HTMLDivElement | null;

        if (mainTag == null)
            return;

        const resizeObserver = new ResizeObserver(() => {
            spacerTag.style.width = `${mainTag.offsetWidth}px`;
            spacerTag.style.height = `${mainTag.offsetHeight}px`;
        });
        resizeObserver.observe(mainTag, {
            box: "content-box"
        });

        return () => {
            resizeObserver.disconnect();
        };
    }, [spacerRef]);

    return <>
        <div className={classNames(className, "main")} {...props} />
        <div ref={spacerRef} className={classNames(className, "spacer")} />
    </>;
}

type DivProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type FixedDivWithSpacerProps = DivProps;
