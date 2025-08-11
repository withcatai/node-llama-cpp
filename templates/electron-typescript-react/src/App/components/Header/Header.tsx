import {CSSProperties} from "react";
import classNames from "classnames";
import {LoadFileIconSVG} from "../../../icons/LoadFileIconSVG.tsx";
import {DeleteIconSVG} from "../../../icons/DeleteIconSVG.tsx";
import {FixedDivWithSpacer} from "../FixedDivWithSpacer/FixedDivWithSpacer.tsx";
import {UpdateBadge} from "./components/UpdateBadge.tsx";

import "./Header.css";


export function Header({appVersion, canShowCurrentVersion, modelName, onLoadClick, loadPercentage, onResetChatClick}: HeaderProps) {
    // we use a FixedDivWithSpacer to push down the content while keeping the header fixed.
    // this allows the content to have macOS's scroll bounce while keeping the header fixed at the top.
    return <FixedDivWithSpacer className="appHeader">
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
                <DeleteIconSVG className="icon" />
            </button>
            <button className="loadModelButton" onClick={onLoadClick} disabled={onLoadClick == null}>
                <LoadFileIconSVG className="icon" />
            </button>
        </div>
        <div className="spacer" />
        <UpdateBadge
            appVersion={appVersion}
            canShowCurrentVersion={canShowCurrentVersion}
        />
    </FixedDivWithSpacer>;
}

type HeaderProps = {
    appVersion?: string,
    canShowCurrentVersion?: boolean,
    modelName?: string,
    onLoadClick?(): void,
    loadPercentage?: number,
    onResetChatClick?(): void
};
