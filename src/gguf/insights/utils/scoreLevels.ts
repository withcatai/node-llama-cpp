export function scoreLevels(num: number, levels: {start: number, end?: number, points: number}[]) {
    let res = 0;

    for (let i = 0; i < levels.length; i++) {
        const level = levels[i]!;
        const start = level.start;
        const end = level.end ?? levels[i + 1]?.start ?? Math.max(start, num);

        if (num < start)
            break;
        else if (num >= end)
            res += level.points;
        else
            res += level.points * ((num - start) / (end - start));
    }

    return res;
}
