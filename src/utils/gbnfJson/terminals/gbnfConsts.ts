export const grammarNoValue = '""';
export const reservedRuleNames = {
    null: "null-rule",
    boolean: "boolean-rule",
    number: {
        fractional: "fractional-number-rule",
        integer: "integer-number-rule"
    },
    string: "string-rule",
    whitespace({newLine, nestingScope, scopeSpaces}: {
        newLine?: "before" | "after" | false, nestingScope: number, scopeSpaces: number
    }) {
        if (!newLine)
            return "whitespace-no-new-lines-rule";

        return [
            "whitespace-",
            newLine === "before"
                ? "b"
                : newLine === "after"
                    ? "a"
                    : "n",
            "-" + nestingScope,
            "-" + scopeSpaces,
            "-rule"
        ].join("");
    }
} as const;
