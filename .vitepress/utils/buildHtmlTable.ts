export function buildHtmlTable(header: string[], rows: string[][]) {
    let res = "";

    res += "<table>\n";

    if (header.length > 0) {
        res += "" + "<thead>\n";
        res += "" + "" + "<tr>\n";
        for (const headerCell of header) {
            res += "" + "" + "" + "<th>" + headerCell + "</th>\n";
        }
        res += "" + "" + "</tr>\n";
        res += "" + "</thead>\n";
    }

    if (rows.length > 0) {
        res += "" + '<tbody style="white-space: pre-wrap">\n';

        for (const row of rows) {
            res += "" + "" + "<tr>\n";

            for (const cell of row) {
                res += "" + "" + "" + "<td>" + cell + "</td>\n";
            }

            res += "" + "" + "</tr>\n";
        }

        res += "" + "</tbody>\n";
    }

    res += "</table>\n";

    return res;
}
