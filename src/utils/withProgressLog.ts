import process from "process";
import UpdateManager from "stdout-update";
import sliceAnsi from "slice-ansi";
import stripAnsi from "strip-ansi";
import chalk from "chalk";
import logSymbols from "log-symbols";
import prettyMilliseconds from "pretty-ms";
import {useCiLogs} from "../config.js";
import {clockChar} from "../consts.js";
import {ConsoleInteraction, ConsoleInteractionKey} from "../cli/utils/ConsoleInteraction.js";
import {getConsoleLogPrefix} from "./getConsoleLogPrefix.js";
import withOra from "./withOra.js";

export async function withProgressLog<T>({
    loadingText,
    successText,
    failText,
    liveUpdates = true,
    statusIcons = true,
    initialPercentage = 0,
    initialProgressBarText,
    progressBarLength = 40,
    minPercentageChangeForNonLiveUpdates = 0.1,
    eta = true,
    etaUpdateInterval = 1000,
    noProgress = false,
    progressFractionDigits = true,
    noSuccessLiveStatus = false,
    liveCtrlCSendsAbortSignal = false
}: {
    loadingText: string,
    successText: string,
    failText: string,
    liveUpdates?: boolean,
    statusIcons?: boolean,
    initialPercentage?: number,
    initialProgressBarText?: string,
    progressBarLength?: number,
    minPercentageChangeForNonLiveUpdates?: number,
    eta?: boolean,
    etaUpdateInterval?: number,
    noProgress?: boolean,
    progressFractionDigits?: boolean,
    noSuccessLiveStatus?: boolean,
    liveCtrlCSendsAbortSignal?: boolean
}, callback: (progressUpdater: ProgressUpdater) => Promise<T>): Promise<T> {
    const shouldLiveUpdate = !useCiLogs && liveUpdates;
    const startTime = Date.now();
    const abortController = new AbortController();
    let currentProgress = initialPercentage;
    let currentProgressBarText = initialProgressBarText;
    let isAborted = false;

    const getEta = () => {
        const now = Date.now();

        if (!eta || currentProgress === 1 || now - startTime < 1000)
            return null;

        const timeRemaining = ((now - startTime) / currentProgress) * (1 - currentProgress);

        if (!Number.isFinite(timeRemaining) || typeof timeRemaining === "bigint")
            return null;

        if (timeRemaining < 1000)
            return "0s left";

        try {
            return prettyMilliseconds(timeRemaining, {
                keepDecimalsOnWholeSeconds: true,
                secondsDecimalDigits: 2,
                compact: true
            }) + " left";
        } catch (err) {
            return null;
        }
    };

    if (noProgress) {
        return withOra({
            loading: loadingText,
            success: successText,
            fail: failText,
            useStatusLogs: !shouldLiveUpdate,
            noSuccessLiveStatus
        }, () => {
            const progressUpdater: ProgressUpdater = {
                setProgress: () => progressUpdater
            };

            return callback(progressUpdater);
        });
    } else if (!shouldLiveUpdate) {
        const getLoadingText = () => {
            const formattedProgress = (currentProgress * 100)
                .toLocaleString("en-US", {
                    minimumIntegerDigits: 1,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: progressFractionDigits ? 3 : 0
                }) + "%";

            const etaText = getEta();

            return [
                chalk.cyan(clockChar),
                loadingText,
                chalk.yellow(formattedProgress),
                (currentProgressBarText != null && currentProgressBarText !== "")
                    ? chalk.gray(
                        currentProgressBarText + (
                            etaText != null
                                ? (" | " + etaText)
                                : ""
                        )
                    )
                    : chalk.gray(etaText ?? "")
            ].join(" ");
        };

        let lastLogProgress = initialPercentage;
        let lastLogProgressBarText = initialProgressBarText;
        const progressUpdater: ProgressUpdater = {
            setProgress(progress, progressText) {
                currentProgress = progress;
                currentProgressBarText = progressText;

                if (Math.abs(currentProgress - lastLogProgress) >= minPercentageChangeForNonLiveUpdates ||
                    currentProgressBarText !== lastLogProgressBarText ||
                    (progress === 1 && lastLogProgress !== 1)
                ) {
                    console.log(getConsoleLogPrefix() + getLoadingText());
                    lastLogProgress = currentProgress;
                    lastLogProgressBarText = currentProgressBarText;
                }

                return progressUpdater;
            }
        };

        console.log(getConsoleLogPrefix() + getLoadingText());

        try {
            const res = await callback(progressUpdater);

            console.log(getConsoleLogPrefix() + `${logSymbols.success} ${successText}`);

            return res;
        } catch (er) {
            console.log(getConsoleLogPrefix() + `${logSymbols.error} ${failText}`);

            throw er;
        }
    }

    const updateManager = UpdateManager.getInstance();
    let etaUpdateTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

    function getProgressLine() {
        const formattedProgress = (currentProgress * 100)
            .toLocaleString("en-US", {
                minimumIntegerDigits: 1,
                minimumFractionDigits: progressFractionDigits ? 4 : 0,
                maximumFractionDigits: progressFractionDigits ? 4 : 0
            })
            .slice(0, 5) + "%";
        const addedText = (currentProgressBarText != null && currentProgressBarText !== "")
            ? currentProgressBarText
            : "";
        const leftPad = " ".repeat(
            Math.floor(
                (
                    progressBarLength - stripAnsi(
                        formattedProgress + (
                            addedText.length > 0
                                ? (addedText + 1)
                                : 0
                        )
                    ).length
                ) / 2
            )
        );

        return [
            loadingText,
            renderProgressBar({
                barText: leftPad + ` ${chalk.black.bgWhiteBright(formattedProgress)}${addedText.length === 0 ? "" : (" " + chalk.gray(addedText))} `,
                backgroundText: leftPad + ` ${chalk.yellow.bgGray(formattedProgress)}${addedText.length === 0 ? "" : (" " + chalk.white(addedText))} `,
                length: progressBarLength,
                loadedPercentage: Math.max(0, Math.min(1, currentProgress)),
                barStyle: chalk.black.bgWhiteBright,
                backgroundStyle: chalk.bgGray
            }),
            isAborted
                ? chalk.red("Aborted")
                : chalk.gray(getEta() ?? "")
        ].join(" ");
    }

    function updateProgressBar() {
        updateManager.update([
            getConsoleLogPrefix() + getProgressLine()
        ]);

        clearTimeout(etaUpdateTimeout);
        if (eta && currentProgress !== 1)
            etaUpdateTimeout = setTimeout(updateProgressBar, etaUpdateInterval);
    }

    const progressUpdater: ProgressUpdater = {
        setProgress(progress, progressText) {
            currentProgress = progress;
            currentProgressBarText = progressText;

            if (!isAborted)
                updateProgressBar();

            return progressUpdater;
        },
        abortSignal: liveCtrlCSendsAbortSignal
            ? abortController.signal
            : undefined
    };

    updateManager.hook();
    const consoleInteraction = new ConsoleInteraction();
    let moveCursorUpAfterUnhook = false;

    consoleInteraction.onKey(ConsoleInteractionKey.ctrlC, () => {
        isAborted = true;

        if (liveCtrlCSendsAbortSignal) {
            abortController.abort();
            consoleInteraction.stop();

            updateProgressBar();

            updateManager.unhook(true);
        } else {
            consoleInteraction.stop();
            updateManager.unhook(true);
            updateProgressBar();

            process.exit(0);
        }
    });

    try {
        updateProgressBar();
        consoleInteraction.start();

        const res = await callback(progressUpdater);

        clearTimeout(etaUpdateTimeout);

        if (noSuccessLiveStatus) {
            updateManager.update([""]);
            moveCursorUpAfterUnhook = true;
        } else
            updateManager.update([
                getConsoleLogPrefix() + (
                    statusIcons
                        ? (logSymbols.success + " ")
                        : ""
                ) + successText
            ]);

        return res;
    } catch (err) {
        updateManager.update([
            getConsoleLogPrefix() + (
                statusIcons
                    ? (logSymbols.error + " ")
                    : ""
            ) + failText
        ]);

        throw err;
    } finally {
        consoleInteraction.stop();
        updateManager.unhook(true);

        if (moveCursorUpAfterUnhook)
            process.stdout.moveCursor(0, -1);
    }
}

type ProgressUpdater = {
    setProgress(percentage: number, progressText?: string): ProgressUpdater,
    abortSignal?: AbortSignal
};

function renderProgressBar({
    barText, backgroundText, length, loadedPercentage, barStyle, backgroundStyle
}: {
    barText: string,
    backgroundText: string,
    length: number,
    loadedPercentage: number,
    barStyle(text: string): string,
    backgroundStyle(text: string): string
}) {
    const barChars = Math.floor(length * loadedPercentage);
    const backgroundChars = length - barChars;

    const slicedBarText = sliceAnsi(barText, 0, barChars);
    const paddedBarText = slicedBarText + " ".repeat(barChars - stripAnsi(slicedBarText).length);
    const slicedBackgroundText = sliceAnsi(backgroundText, barChars, barChars + backgroundChars);
    const paddedBackgroundText = slicedBackgroundText + " ".repeat(backgroundChars - stripAnsi(slicedBackgroundText).length);

    return barStyle(paddedBarText) + backgroundStyle(paddedBackgroundText);
}
