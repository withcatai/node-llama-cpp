import {CSSProperties} from "react";
import classNames from "classnames";
import {LoadFileIconSVG} from "../../../icons/LoadFileIconSVG.tsx";
import {DeleteIconSVG} from "../../../icons/DeleteIconSVG.tsx";

import "./Header.css";


export function Header({modelName, onLoadClick, loadPercentage, onResetChatClick}: HeaderProps) {
    return <div className="appHeader">
        <div className="panel model">
            <div
                className={classNames("progress", loadPercentage === 1 && "hide")}
                style={{
                    "--progress": loadPercentage != null ? (loadPercentage * 100) : undefined
                } as CSSProperties}
            />

            {
                modelName != null &&
                <div className="modelName">{modelName}</div>
            }
            {
                modelName == null &&
                <div className="noModel">No model loaded</div>
            }

            <button
                className="resetChatButton"
                disabled={onResetChatClick == null}
                onClick={onResetChatClick}
            >
                <DeleteIconSVG className="icon"/>
            </button>
            <button className="loadModelButton" onClick={onLoadClick} disabled={onLoadClick == null}>
                <LoadFileIconSVG className="icon"/>
            </button>
        </div>
        <div className="spacer"/>
    </div>;
}

type HeaderProps = {
    modelName?: string,
    onLoadClick?(): void,
    loadPercentage?: number,
    onResetChatClick?(): void
};
