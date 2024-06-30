import stripAnsi from "strip-ansi";
import sliceAnsi from "slice-ansi";

export function splitAnsiToLines(text: string | undefined, width: number, maxRoundToWords: number = Math.min(16, width)) {
    if (text == null || text === "")
        return [];

    const lines: string[] = [];
    const linesWithoutAnsi = stripAnsi(text).split("\n");
    let textIndex = 0;

    for (const line of linesWithoutAnsi) {
        for (let lineIndex = 0; lineIndex < line.length;) {
            let currentWidth = width;

            if (maxRoundToWords > 0) {
                const currentMaxWidth = Math.min(currentWidth, line.length - lineIndex);
                const currentChunkLastChar = line[lineIndex + currentMaxWidth - 1];
                const nextChunkFirstChar = line[lineIndex + currentMaxWidth] ?? "";

                if (currentChunkLastChar !== " " && nextChunkFirstChar !== "" && nextChunkFirstChar !== " ") {
                    const lastSpaceIndex = line.lastIndexOf(" ", lineIndex + currentMaxWidth - 1);
                    if (lastSpaceIndex >= 0) {
                        const diff = currentMaxWidth - (lastSpaceIndex + " ".length);
                        if (diff > 0 && diff < maxRoundToWords && diff < currentWidth)
                            currentWidth -= diff;
                    }
                }
            }

            lines.push(sliceAnsi(text, textIndex + lineIndex, Math.min(textIndex + lineIndex + currentWidth, textIndex + line.length)));
            lineIndex += currentWidth;
        }

        textIndex += line.length + "\n".length;
    }

    return lines;
}
