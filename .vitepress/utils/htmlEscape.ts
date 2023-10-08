export function htmlEscape(string?: string | number | boolean) {
    if (typeof string === "number")
        return String(string);
    else if (typeof string === "boolean")
        return String(string);

    if (typeof string !== "string")
        return "";

    return string
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

