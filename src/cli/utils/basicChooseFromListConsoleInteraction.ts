import process from "process";
import UpdateManager from "stdout-update";
import stripAnsi from "strip-ansi";
import sliceAnsi from "slice-ansi";
import chalk from "chalk";
import {ConsoleInteraction, ConsoleInteractionKey} from "./ConsoleInteraction.js";
import {splitAnsiToLines} from "./splitAnsiToLines.js";

export async function basicChooseFromListConsoleInteraction<T>({
    title,
    footer,
    items,
    renderItem,
    canFocusItem,
    canSelectItem,
    initialFocusIndex = 0,
    aboveItemsPadding = 1,
    belowItemsPadding = 1,
    renderSummaryOnExit = (item) => (item == null ? "" : renderItem(item, false, () => void 0)),
    exitOnCtrlC = true
}: {
    title: string | ((focusedItem: T, rerender: () => void) => string),
    footer?: string | ((focusedItem: T, rerender: () => void) => string | undefined),
    items: T[],
    renderItem(item: T, focused: boolean, rerender: () => void): string,
    canFocusItem?(item: T): boolean,
    canSelectItem?(item: T): boolean,
    initialFocusIndex?: number,
    aboveItemsPadding?: number,
    belowItemsPadding?: number,
    renderSummaryOnExit?(item: T | null): string,
    exitOnCtrlC?: boolean
}): Promise<T | null> {
    const updateManager = UpdateManager.getInstance();
    let focusIndex = initialFocusIndex;
    let scrollOffset = 0;
    let rerenderTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
    let isDone = false;

    function adjustScrollOffset(screenLines: number) {
        if (focusIndex < scrollOffset + aboveItemsPadding)
            scrollOffset = Math.max(0, focusIndex - aboveItemsPadding);
        else if (focusIndex > scrollOffset + screenLines - belowItemsPadding)
            scrollOffset = Math.min(Math.max(0, focusIndex - screenLines + belowItemsPadding), items.length - 1 - screenLines);
    }

    function scheduleRerender() {
        if (isDone)
            return;

        if (rerenderTimeout == null)
            rerenderTimeout = setTimeout(renderScreen, 0);
    }

    function renderScreen() {
        clearTimeout(rerenderTimeout);
        rerenderTimeout = undefined;

        if (isDone)
            return;

        while (canFocusItem != null && focusIndex > 0 && !canFocusItem(items[focusIndex]!))
            focusIndex--;

        while (canFocusItem != null && focusIndex < items.length - 1 && !canFocusItem(items[focusIndex]!))
            focusIndex++;

        const maxWidth = (process.stdout.columns ?? 80) - 2;
        const maxHeight = (process.stdout.rows ?? 24) - 2;

        const focusedItem = items[focusIndex]!;
        const titleLines = splitAnsiToLines(title instanceof Function ? title(focusedItem, scheduleRerender) : title, maxWidth);
        const footerLines = splitAnsiToLines(footer instanceof Function ? footer(focusedItem, scheduleRerender) : footer, maxWidth);

        const reservedLinesCount = titleLines.length + footerLines.length;
        const maxItemLinesCount = Math.max(1, maxHeight - reservedLinesCount);

        adjustScrollOffset(maxItemLinesCount);

        updateManager.update([
            ...titleLines,
            ...items
                .slice(scrollOffset, scrollOffset + maxItemLinesCount + 1)
                .map((item, index) => (
                    renderSingleLine(renderItem(item, scrollOffset + index === focusIndex, scheduleRerender), maxWidth)
                )),
            ...footerLines
        ]);
    }

    updateManager.hook();
    const consoleInteraction = new ConsoleInteraction();

    try {
        consoleInteraction.onKey(ConsoleInteractionKey.upArrow, () => {
            let newFocusIndex = Math.max(0, focusIndex - 1);
            while (newFocusIndex > 0 && canFocusItem != null && !canFocusItem(items[newFocusIndex]!))
                newFocusIndex--;

            if (canFocusItem == null || canFocusItem(items[newFocusIndex]!)) {
                focusIndex = newFocusIndex;
                renderScreen();
            }
        });
        consoleInteraction.onKey(ConsoleInteractionKey.downArrow, () => {
            let newFocusIndex = Math.min(items.length - 1, focusIndex + 1);
            while (newFocusIndex < items.length - 1 && canFocusItem != null && !canFocusItem(items[newFocusIndex]!))
                newFocusIndex++;

            if (canFocusItem == null || canFocusItem(items[newFocusIndex]!)) {
                focusIndex = newFocusIndex;
                renderScreen();
            }
        });

        process.on("SIGWINCH", renderScreen);
        renderScreen();

        const res = await new Promise<T | null>((resolve) => {
            consoleInteraction.onKey(ConsoleInteractionKey.enter, () => {
                if (canSelectItem == null || canSelectItem(items[focusIndex]!))
                    resolve(items[focusIndex]!);
            });

            consoleInteraction.onKey(ConsoleInteractionKey.ctrlC, () => {
                if (exitOnCtrlC) {
                    updateManager.update([""]);
                    consoleInteraction.stop();
                    updateManager.unhook(true);
                    process.exit(0);
                }

                resolve(null);
            });

            consoleInteraction.start();
        });

        isDone = true;
        clearTimeout(rerenderTimeout);
        rerenderTimeout = undefined;

        process.off("SIGWINCH", renderScreen);
        updateManager.update([
            renderSummaryOnExit(res)
        ]);

        return res;
    } finally {
        consoleInteraction.stop();
        updateManager.unhook(true);
    }
}

function renderSingleLine(text: string, maxWidth: number) {
    const textWithoutAnsi = stripAnsi(text);

    const moreText = "...";
    if (textWithoutAnsi.length > maxWidth)
        return sliceAnsi(text, 0, maxWidth - moreText.length) + chalk.gray(moreText);

    return text;
}

