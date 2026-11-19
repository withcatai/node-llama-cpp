export function getForkExecArgv(execArgv: readonly string[] = process.execArgv): string[] {
    const result: string[] = [];

    for (let i = 0; i < execArgv.length; i++) {
        const arg = execArgv[i]!;

        // Explicit execArgv also bypasses fork's removal of the parent eval arguments.
        if (arg === "--input-type" || arg === "-e" || arg === "--eval" || arg === "-pe") {
            i++;
            continue;
        }

        if (arg === "-p" || arg === "--print") {
            if (execArgv[i + 1] != null && !execArgv[i + 1]!.startsWith("-"))
                i++;
            continue;
        }

        if (arg.startsWith("--input-type=") || arg.startsWith("--eval=") || arg.startsWith("--print="))
            continue;

        result.push(arg);
    }

    return result;
}
