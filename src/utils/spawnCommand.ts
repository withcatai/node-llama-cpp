import spawn from "cross-spawn";

export function spawnCommand(
    command: string, args: string[], cwd: string, env = process.env, progressLogs: boolean = true
) {
    function getCommandString() {
        let res = command;

        for (const arg of args) {
            if (arg.includes(" ")) {
                res += ` "${arg.split('"').join('\\"')}"`;
            } else {
                res += ` ${arg}`;
            }
        }

        return res;
    }

    return new Promise<{stdout: string, stderr: string, combinedStd: string}>((resolve, reject) => {
        const stdout: string[] = [];
        const stderr: string[] = [];
        const combinedStd: string[] = [];

        function createResult() {
            const finalStdout = stdout.join("");
            stdout.length = 0;
            const finalStderr = stderr.join("");
            stderr.length = 0;
            const finalCombinedStd = combinedStd.join("");
            combinedStd.length = 0;

            return {
                stdout: finalStdout,
                stderr: finalStderr,
                combinedStd: finalCombinedStd
            };
        }

        function createError(message: string) {
            const {stdout: finalStdout, stderr: finalStderr, combinedStd: finalCombinedStd} = createResult();

            return new SpawnError(message, finalStdout, finalStderr, finalCombinedStd);
        }

        const child = spawn(command, args, {
            stdio: [null, null, null],
            cwd,
            env,
            detached: false,
            windowsHide: true
        });

        child.on("exit", (code) => {
            if (code == 0)
                resolve(createResult());
            else
                reject(createError(`Command ${getCommandString()} exited with code ${code}`));
        });
        child.on("error", reject);
        child.on("disconnect", () => reject(new Error(`Command ${getCommandString()} disconnected`)));
        child.on("close", (code) => {
            if (code == 0)
                resolve(createResult());
            else
                reject(createError(`Command ${getCommandString()} closed with code ${code}`));
        });

        if (progressLogs) {
            child.stdout?.pipe(process.stdout);
            child.stderr?.pipe(process.stderr);
            process.stdin.pipe(child.stdin!);
        } else {
            child.stderr?.pipe(process.stderr);
        }

        child.stdout?.on("data", (data) => {
            stdout.push(data.toString());
            combinedStd.push(data.toString());
        });
        child.stderr?.on("data", (data) => {
            stderr.push(data.toString());
            combinedStd.push(data.toString());
        });
    });
}

export class SpawnError extends Error {
    public readonly stdout: string;
    public readonly stderr: string;
    public readonly combinedStd: string;

    public constructor(message: string, stdout: string, stderr: string, combinedStd: string) {
        super(message);

        Object.defineProperty(this, "stdout" satisfies keyof this, {enumerable: false});
        Object.defineProperty(this, "stderr" satisfies keyof this, {enumerable: false});
        Object.defineProperty(this, "combinedStd" satisfies keyof this, {enumerable: false});

        this.stdout = stdout;
        this.stderr = stderr;
        this.combinedStd = combinedStd;
    }
}
