import process from "process";
import chalk from "chalk";

export const enum ConsoleInteractionKey {
    ctrlC = "\u0003",
    upArrow = "\u001b[A",
    downArrow = "\u001b[B",
    enter = "\r"
}

export class ConsoleInteraction {
    /** @internal */ private readonly _keyCallbacks: Map<string | ConsoleInteractionKey, (() => void)[]> = new Map();
    /** @internal */ private readonly _stdin: NodeJS.ReadStream;
    /** @internal */ private _isActive: boolean = false;

    public constructor({stdin = process.stdin}: {stdin?: NodeJS.ReadStream} = {}) {
        this._stdin = stdin;
        this._onData = this._onData.bind(this);
    }

    public get isActive() {
        return this._isActive;
    }

    public start() {
        if (this._isActive)
            return;

        this._isActive = true;

        if (this._stdin.isTTY)
            this._stdin.setRawMode(true);

        this._stdin.on("data", this._onData);
        this._stdin.resume();
    }

    public stop() {
        if (!this._isActive)
            return;

        this._isActive = false;

        if (this._stdin.isTTY)
            this._stdin.setRawMode(false);

        this._stdin.off("data", this._onData);
        this._stdin.pause();
    }

    public onKey(key: string | ConsoleInteractionKey | (string | ConsoleInteractionKey)[], callback: () => void) {
        if (typeof key === "string")
            key = [key];

        for (const k of key) {
            if (!this._keyCallbacks.has(k))
                this._keyCallbacks.set(k, []);

            this._keyCallbacks.get(k)!.push(callback);
        }

        return ConsoleInteractionOnKeyHandle._create(() => {
            for (const k of key) {
                const callbacks = this._keyCallbacks.get(k);

                if (callbacks == null)
                    continue;

                const index = callbacks.indexOf(callback);

                if (index >= 0)
                    callbacks.splice(index, 1);
            }
        });
    }

    /** @internal */
    private _onData(data: Buffer) {
        if (!this._isActive)
            return;

        const key = data.toString();
        const callbacks = this._keyCallbacks.get(key) ?? [];

        if (callbacks.length === 0 && key === ConsoleInteractionKey.ctrlC) {
            process.stdout.write("\n");
            this.stop();
            process.exit(0);
        }

        for (const callback of callbacks) {
            try {
                callback();
            } catch (err) {
                console.error(err);
            }
        }
    }

    public static yesNoQuestion(question: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const interaction = new ConsoleInteraction();

            interaction.onKey(["Y", "y"], () => {
                resolve(true);
                interaction.stop();
                process.stdout.write("\n");
            });
            interaction.onKey(["N", "n"], () => {
                resolve(false);
                interaction.stop();
                process.stdout.write("\n");
            });

            console.log();
            process.stdout.write(question + " " + chalk.gray("(Y/n) "));
            interaction.start();
        });
    }
}

export class ConsoleInteractionOnKeyHandle {
    /** @internal */
    private _dispose: (() => void) | null;

    private constructor(dispose: () => void) {
        this._dispose = dispose;

        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }

    public dispose() {
        if (this._dispose != null) {
            this._dispose();
            this._dispose = null;
        }
    }

    public [Symbol.dispose]() {
        this.dispose();
    }

    public get disposed() {
        return this._dispose == null;
    }

    /** @internal */
    public static _create(dispose: () => void) {
        return new ConsoleInteractionOnKeyHandle(dispose);
    }
}
