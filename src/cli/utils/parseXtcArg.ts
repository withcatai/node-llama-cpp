const xtcArgFormat = /^(\d+|\d*\.\d+),(\d*|\d?\.\d+)$/;

export function parseXtcArg(xtcString?: string): ParsedXtcArg | undefined {
    if (xtcString == null || xtcString === "")
        return undefined;

    const match = xtcString.match(xtcArgFormat);
    if (match != null && match[1] != null && match[2] != null) {
        const probability = parseFloat(match[1]);
        const threshold = parseFloat(match[2]);

        if (probability >= 0 && probability <= 1 && threshold >= 0 && threshold <= 1) {
            return {probability, threshold};
        }
    }

    throw new Error(
        `Invalid xtc argument: ${xtcString}. ` +
        'Expected format: "probability,threshold" where probability and threshold are numbers between 0 and 1.'
    );
}

export type ParsedXtcArg = {
    probability: number,
    threshold: number
};
