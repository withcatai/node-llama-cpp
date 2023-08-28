import spawn from "cross-spawn";

export function spawnCommand(command: string, args: string[], cwd: string, env = process.env) {
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

    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            cwd,
            env,
            detached: false,
            windowsHide: true
        });

        child.on("exit", (code) => {
            if (code == 0)
                resolve();
            else
                reject(new Error(`Command ${getCommandString()} exited with code ${code}`));
        });
        child.on("error", reject);
        child.on("disconnect", () => reject(new Error(`Command ${getCommandString()} disconnected`)));
        child.on("close", code => {
            if (code == 0)
                resolve();
            else
                reject(new Error(`Command ${getCommandString()} closed with code ${code}`));
        });
    });
}
