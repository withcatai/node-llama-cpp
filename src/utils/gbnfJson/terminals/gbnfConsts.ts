export const grammarNoValue = '""';
export const reservedRuleNames = {
    null: "null-rule",
    boolean: "boolean-rule",
    number: {
        fractional: "fractional-number-rule",
        integer: "integer-number-rule"
    },
    string: "string-rule",
    whitespace: {
        withNewLines: "whitespace-new-lines-rule",
        withoutNewLines: "whitespace-no-new-lines-rule"
    }
} as const;
