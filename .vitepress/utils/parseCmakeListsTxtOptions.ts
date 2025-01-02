const maxLinesSpan = 10;

const cmakeOptionRegex =
    /^\s*option\([\s\t\n\r]*(?<key>\S+)[\s\t\n\r]+"(?<description>(?:\\"|[^"])*)"[\s\t\n\r]+(?<defaultValue>\S+)[\s\t\n\r]*\)/;
export function parseCmakeListsTxtOptions(cmakeListsTxtString: string) {
    const lines = cmakeListsTxtString.split("\n");

    return lines
        .map((line, index) => {
            const match = lines
                .slice(index, index + maxLinesSpan)
                .join("\n")
                .match(cmakeOptionRegex);
            if (match == null || match.groups == null || match?.index !== 0)
                return null;

            const totalLines = match[0]?.split("\n")?.length ?? 1;

            const {key, description, defaultValue} = match.groups;
            if (key == null)
                return null;

            return {
                lineNumber: index + 1,
                totalLines,
                key,
                description: description != null
                    ? description.replaceAll('\\"', '"')
                    : description,
                defaultValue
            };
        })
        .filter((option) => option != null);
}
