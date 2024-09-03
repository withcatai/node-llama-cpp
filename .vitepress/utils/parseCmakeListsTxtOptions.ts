export function parseCmakeListsTxtOptions(cmakeListsTxtString: string) {
    const lines = cmakeListsTxtString.split("\n");

    return lines
        .map((line, index) => {
            const match = line.match(/^option\([\s\t\n\r]*(?<key>\S+)[\s\t\n\r]+"(?<description>(?:\\"|[^"])*)"[\s\t\n\r]+(?<defaultValue>\S+)[\s\t\n\r]*\)/);
            if (match == null || match.groups == null)
                return null;

            const {key, description, defaultValue} = match.groups;
            if (key == null)
                return null;

            return {
                lineNumber: index + 1,
                key,
                description: description != null
                    ? description.replaceAll('\\"', '"')
                    : description,
                defaultValue
            };
        })
        .filter((option) => option != null)
}
