/**
 * Like `JSON.stringify` but results in a value formatted in the format that Python produces when using `json.dumps(value)`.
 *
 * We need to format results this way since this is what many models use in their training data,
 * so this is what many models expect to have in their context state.
 */
export function jsonDumps(value: any) {
    return JSON.stringify(value, null, 1)
        .split("\n")
        .map((line) => {
            line = line.trim();

            if (line.endsWith(","))
                line += " ";

            return line;
        })
        .join("");
}
