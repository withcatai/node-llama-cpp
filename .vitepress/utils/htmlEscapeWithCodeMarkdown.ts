import {htmlEscape} from "./htmlEscape.js";

export function htmlEscapeWithCodeMarkdown(string?: string | number | boolean) {
    const escapedString = htmlEscape(string);

    let res = "";
    let backtickIndex = escapedString.indexOf("`");
    let textIndex = 0;

    while (backtickIndex >= 0 && backtickIndex < escapedString.length - 1 && textIndex < escapedString.length) {
        const nextBacktickIndex = escapedString.indexOf("`", backtickIndex + 1);
        if (nextBacktickIndex < 0)
            break;

        res += escapedString.slice(textIndex, backtickIndex) + "<code>" + escapedString.slice(backtickIndex + 1, nextBacktickIndex) + "</code>";
        textIndex = nextBacktickIndex + 1;

        if (textIndex < escapedString.length)
            backtickIndex = escapedString.indexOf("`", textIndex);
    }

    res += escapedString.slice(textIndex);

    return res;
}

