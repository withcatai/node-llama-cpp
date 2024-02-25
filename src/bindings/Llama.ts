import chalk from "chalk";
import {getConsoleLogPrefix} from "../utils/getConsoleLogPrefix.js";
import {BindingModule} from "./AddonTypes.js";
import {BuildMetadataFile, LlamaLogLevel} from "./types.js";

const LlamaLogLevelToAddonLogLevel: ReadonlyMap<LlamaLogLevel, number> = new Map([
    [LlamaLogLevel.disabled, 0],
    [LlamaLogLevel.fatal, 1],
    [LlamaLogLevel.error, 2],
    [LlamaLogLevel.warn, 3],
    [LlamaLogLevel.info, 4],
    [LlamaLogLevel.debug, 5]
]);
const addonLogLevelToLlamaLogLevel: ReadonlyMap<number, LlamaLogLevel> = new Map(
    [...LlamaLogLevelToAddonLogLevel.entries()].map(([key, value]) => [value, key])
);
const defaultLogLevel = 5;

export class Llama {
    /** @internal */ public readonly _bindings: BindingModule;
    /** @internal */ private readonly _metal: boolean;
    /** @internal */ private readonly _cuda: boolean;
    /** @internal */ private readonly _vulkan: boolean;
    /** @internal */ private readonly _buildType: "localBuild" | "prebuilt";
    /** @internal */ private readonly _cmakeOptions: Readonly<Record<string, string>>;
    /** @internal */ private readonly _llamaCppRelease: {
        readonly repo: string,
        readonly release: string
    };
    /** @internal */ private _logger: ((level: LlamaLogLevel, message: string) => void);
    /** @internal */ private _logLevel: LlamaLogLevel;
    /** @internal */ private _pendingLog: string | null = null;
    /** @internal */ private _pendingLogLevel: LlamaLogLevel | null = null;
    /** @internal */ private _logDispatchQueuedMicrotasks: number = 0;
    /** @internal */ private _previousLog: string | null = null;
    /** @internal */ private _previousLogLevel: LlamaLogLevel | null = null;
    /** @internal */ private _nextLogNeedNewLine: boolean = false;

    private constructor({
        bindings, metal, cuda, vulkan, logLevel, logger, buildType, cmakeOptions, llamaCppRelease
    }: {
        bindings: BindingModule,
        metal: boolean,
        cuda: boolean,
        vulkan: boolean,
        logLevel: LlamaLogLevel,
        logger: (level: LlamaLogLevel, message: string) => void,
        buildType: "localBuild" | "prebuilt",
        cmakeOptions: Record<string, string>,
        llamaCppRelease: {
            repo: string,
            release: string
        }
    }) {
        this._bindings = bindings;
        this._metal = metal;
        this._cuda = cuda;
        this._vulkan = vulkan;
        this._logLevel = logLevel ?? LlamaLogLevel.debug;
        this._logger = logger;
        this._buildType = buildType;
        this._cmakeOptions = Object.freeze({...cmakeOptions});
        this._llamaCppRelease = Object.freeze({
            repo: llamaCppRelease.repo,
            release: llamaCppRelease.release
        });

        this._dispatchPendingLogMicrotask = this._dispatchPendingLogMicrotask.bind(this);
        this._onAddonLog = this._onAddonLog.bind(this);

        this._bindings.setLogger(this._onAddonLog);
        this._bindings.setLoggerLogLevel(LlamaLogLevelToAddonLogLevel.get(this._logLevel) ?? defaultLogLevel);
    }

    public get metal() {
        return this._metal;
    }

    public get cuda() {
        return this._cuda;
    }

    public get vulkan() {
        return this._vulkan;
    }

    public get logLevel() {
        return this._logLevel;
    }

    public set logLevel(value: LlamaLogLevel) {
        if (value === this._logLevel)
            return;

        this._bindings.setLoggerLogLevel(LlamaLogLevelToAddonLogLevel.get(value) ?? defaultLogLevel);
        this._logLevel = value;
    }

    public get logger() {
        return this._logger;
    }

    public set logger(value: (level: LlamaLogLevel, message: string) => void) {
        this._logger = value;

        if (value !== Llama.defaultConsoleLogger)
            this._nextLogNeedNewLine = false;
    }

    public get buildType() {
        return this._buildType;
    }

    public get cmakeOptions() {
        return this._cmakeOptions;
    }

    public get llamaCppRelease() {
        return this._llamaCppRelease;
    }

    public get systemInfo() {
        return this._bindings.systemInfo();
    }

    public getVramState() {
        const {total, used} = this._bindings.getGpuVramInfo();

        return {
            total,
            used,
            free: Math.max(0, total - used)
        };
    }

    /** @internal */
    private _onAddonLog(level: number, message: string) {
        const llamaLogLevel = addonLogLevelToLlamaLogLevel.get(level) ?? LlamaLogLevel.fatal;

        if (this._pendingLog != null && this._pendingLogLevel != null && this._pendingLogLevel != llamaLogLevel) {
            this._callLogger(this._pendingLogLevel, this._pendingLog);
            this._pendingLog = null;
        }

        const sourceMessage = (this._pendingLog ?? "") + message;

        const lastNewLineIndex = sourceMessage.lastIndexOf("\n");
        const currentLog = lastNewLineIndex < 0
            ? sourceMessage
            : sourceMessage.slice(0, lastNewLineIndex);
        const nextLog = lastNewLineIndex < 0
            ? ""
            : sourceMessage.slice(lastNewLineIndex + 1);

        if (currentLog !== "")
            this._callLogger(llamaLogLevel, currentLog);

        if (nextLog !== "") {
            this._pendingLog = nextLog;
            this._pendingLogLevel = llamaLogLevel;

            queueMicrotask(this._dispatchPendingLogMicrotask);
            this._logDispatchQueuedMicrotasks++;
        } else
            this._pendingLog = null;
    }

    /** @internal */
    private _dispatchPendingLogMicrotask() {
        this._logDispatchQueuedMicrotasks--;
        if (this._logDispatchQueuedMicrotasks !== 0)
            return;

        if (this._pendingLog != null && this._pendingLogLevel != null) {
            this._callLogger(this._pendingLogLevel, this._pendingLog);
            this._pendingLog = null;
        }
    }

    /** @internal */
    private _callLogger(level: LlamaLogLevel, message: string) {
        // llama.cpp uses dots to indicate progress, so we don't want to print them as different lines,
        // and instead, append to the same log line
        if (logMessageIsOnlyDots(message) && this._logger === Llama.defaultConsoleLogger) {
            if (logMessageIsOnlyDots(this._previousLog) && level === this._previousLogLevel) {
                process.stdout.write(message);
            } else {
                this._nextLogNeedNewLine = true;
                process.stdout.write(prefixAndColorMessage(message, getColorForLogLevel(level)));
            }
        } else {
            if (this._nextLogNeedNewLine) {
                process.stdout.write("\n");
                this._nextLogNeedNewLine = false;
            }

            try {
                this._logger(level, message);
            } catch (err) {
                // the native addon code calls this function, so there's no use to throw an error here
            }
        }

        this._previousLog = message;
        this._previousLogLevel = level;
    }

    /** @internal */
    public static async _create({
        bindings, buildType, buildMetadata, logLevel, logger
    }: {
        bindings: BindingModule,
        buildType: "localBuild" | "prebuilt",
        buildMetadata: BuildMetadataFile,
        logLevel: LlamaLogLevel,
        logger: (level: LlamaLogLevel, message: string) => void
    }) {
        return new Llama({
            bindings,
            buildType,
            metal: buildMetadata.buildOptions.computeLayers.metal,
            cuda: buildMetadata.buildOptions.computeLayers.cuda,
            vulkan: buildMetadata.buildOptions.computeLayers.vulkan,
            cmakeOptions: buildMetadata.buildOptions.customCmakeOptions,
            llamaCppRelease: {
                repo: buildMetadata.buildOptions.llamaCpp.repo,
                release: buildMetadata.buildOptions.llamaCpp.release
            },
            logLevel,
            logger
        });
    }

    public static defaultConsoleLogger(level: LlamaLogLevel, message: string) {
        switch (level) {
            case LlamaLogLevel.disabled:
                break;
            case LlamaLogLevel.fatal:
                // we don't use console.error here because it prints the stack trace
                console.warn(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.error:
                // we don't use console.error here because it prints the stack trace
                console.warn(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.warn:
                console.warn(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.info:
                console.info(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.debug:
                console.debug(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            default:
                void (level satisfies never);
                console.warn(getConsoleLogPrefix() + getColorForLogLevel(LlamaLogLevel.warn)(`Unknown log level: ${level}`));
                console.log(prefixAndColorMessage(message, getColorForLogLevel(level)));
        }

    }
}

function getColorForLogLevel(level: LlamaLogLevel) {
    switch (level) {
        case LlamaLogLevel.disabled: return chalk.whiteBright;
        case LlamaLogLevel.fatal: return chalk.redBright;
        case LlamaLogLevel.error: return chalk.red;
        case LlamaLogLevel.warn: return chalk.yellow;
        case LlamaLogLevel.info: return chalk.whiteBright;
        case LlamaLogLevel.debug: return chalk.white;
        default:
            void (level satisfies never);
            return chalk.whiteBright;
    }
}

function prefixAndColorMessage(message: string, color: (message: string) => string) {
    return getConsoleLogPrefix() + (
        message
            .split("\n")
            .map(line => color(line))
            .join("\n" + getConsoleLogPrefix())
    );
}

function logMessageIsOnlyDots(message: string | null) {
    if (message == null)
        return false;

    for (let i = 0; i < message.length; i++) {
        if (message[i] !== ".")
            return false;
    }

    return true;
}
