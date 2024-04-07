import stripAnsi from "strip-ansi";
import sliceAnsi from "slice-ansi";

export function splitAnsiToLines(text: string | undefined, width: number) {
    if (text == null || text === "")
        return [];

    const lines: string[] = [];
    const linesWithoutAnsi = stripAnsi(text)
        .split("\n");
    let textIndex = 0;

    for (const line of linesWithoutAnsi) {
        for (let lineIndex = 0; lineIndex < line.length; lineIndex += width)
            lines.push(sliceAnsi(text, textIndex + lineIndex, Math.min(textIndex + lineIndex + width, textIndex + line.length)));

        textIndex += line.length + "\n".length;
    }

    return lines;
}
