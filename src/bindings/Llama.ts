import os from "os";
import chalk from "chalk";
import {DisposedError, EventRelay, withLock} from "lifecycle-utils";
import {getConsoleLogPrefix} from "../utils/getConsoleLogPrefix.js";
import {LlamaModel, LlamaModelOptions} from "../evaluator/LlamaModel/LlamaModel.js";
import {DisposeGuard} from "../utils/DisposeGuard.js";
import {GbnfJsonSchema} from "../utils/gbnfJson/types.js";
import {LlamaJsonSchemaGrammar} from "../evaluator/LlamaJsonSchemaGrammar.js";
import {LlamaGrammar, LlamaGrammarOptions} from "../evaluator/LlamaGrammar.js";
import {ThreadsSplitter} from "../utils/ThreadsSplitter.js";
import {getLlamaClasses, LlamaClasses} from "../utils/getLlamaClasses.js";
import {BindingModule} from "./AddonTypes.js";
import {BuildGpu, BuildMetadataFile, LlamaGpuType, LlamaLocks, LlamaLogLevel, LlamaLogLevelGreaterThanOrEqual} from "./types.js";
import {MemoryOrchestrator, MemoryReservation} from "./utils/MemoryOrchestrator.js";

const LlamaLogLevelToAddonLogLevel: ReadonlyMap<LlamaLogLevel, number> = new Map([
    [LlamaLogLevel.disabled, 0],
    [LlamaLogLevel.fatal, 1],
    [LlamaLogLevel.error, 2],
    [LlamaLogLevel.warn, 3],
    [LlamaLogLevel.info, 4],
    [LlamaLogLevel.log, 5],
    [LlamaLogLevel.debug, 6]
]);
const addonLogLevelToLlamaLogLevel: ReadonlyMap<number, LlamaLogLevel> = new Map(
    [...LlamaLogLevelToAddonLogLevel.entries()].map(([key, value]) => [value, key])
);
const defaultLogLevel = 5;
const defaultCPUMinThreadSplitterThreads = 4;

export class Llama {
    /** @internal */ public readonly _bindings: BindingModule;
    /** @internal */ public readonly _backendDisposeGuard = new DisposeGuard();
    /** @internal */ public readonly _memoryLock = {};
    /** @internal */ public readonly _consts: ReturnType<BindingModule["getConsts"]>;
    /** @internal */ public readonly _vramOrchestrator: MemoryOrchestrator;
    /** @internal */ public readonly _vramPadding: MemoryReservation;
    /** @internal */ public readonly _ramOrchestrator: MemoryOrchestrator;
    /** @internal */ public readonly _ramPadding: MemoryReservation;
    /** @internal */ public readonly _swapOrchestrator: MemoryOrchestrator;
    /** @internal */ public readonly _debug: boolean;
    /** @internal */ public readonly _threadsSplitter: ThreadsSplitter;
    /** @internal */ private readonly _gpu: LlamaGpuType;
    /** @internal */ private readonly _buildType: "localBuild" | "prebuilt";
    /** @internal */ private readonly _cmakeOptions: Readonly<Record<string, string>>;
    /** @internal */ private readonly _supportsGpuOffloading: boolean;
    /** @internal */ private readonly _supportsMmap: boolean;
    /** @internal */ private readonly _supportsMlock: boolean;
    /** @internal */ private readonly _mathCores: number;
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
    /** @internal */ private _disposed: boolean = false;

    private _classes?: LlamaClasses;
    public readonly onDispose = new EventRelay<void>();

    private constructor({
        bindings, logLevel, logger, buildType, cmakeOptions, llamaCppRelease, debug, gpu, maxThreads, vramOrchestrator, vramPadding,
        ramOrchestrator, ramPadding, swapOrchestrator
    }: {
        bindings: BindingModule,
        logLevel: LlamaLogLevel,
        logger: (level: LlamaLogLevel, message: string) => void,
        buildType: "localBuild" | "prebuilt",
        cmakeOptions: Record<string, string>,
        llamaCppRelease: {
            repo: string,
            release: string
        },
        debug: boolean,
        gpu: BuildGpu,
        maxThreads?: number,
        vramOrchestrator: MemoryOrchestrator,
        vramPadding: MemoryReservation,
        ramOrchestrator: MemoryOrchestrator,
        ramPadding: MemoryReservation,
        swapOrchestrator: MemoryOrchestrator
    }) {
        this._bindings = bindings;
        this._gpu = gpu;
        this._supportsGpuOffloading = bindings.getSupportsGpuOffloading();
        this._supportsMmap = bindings.getSupportsMmap();
        this._supportsMlock = bindings.getSupportsMlock();
        this._mathCores = bindings.getMathCores();
        this._consts = bindings.getConsts();
        this._debug = debug;
        this._vramOrchestrator = vramOrchestrator;
        this._vramPadding = vramPadding;
        this._ramOrchestrator = ramOrchestrator;
        this._ramPadding = ramPadding;
        this._swapOrchestrator = swapOrchestrator;
        this._threadsSplitter = new ThreadsSplitter(
            maxThreads ?? (
                this._gpu === false
                    ? Math.max(defaultCPUMinThreadSplitterThreads, this._mathCores)
                    : 0
            )
        );

        this._logLevel = this._debug
            ? LlamaLogLevel.debug
            : (logLevel ?? LlamaLogLevel.debug);
        this._logger = logger;
        this._buildType = buildType;
        this._cmakeOptions = Object.freeze({...cmakeOptions});
        this._llamaCppRelease = Object.freeze({
            repo: llamaCppRelease.repo,
            release: llamaCppRelease.release
        });

        this._dispatchPendingLogMicrotask = this._dispatchPendingLogMicrotask.bind(this);
        this._onAddonLog = this._onAddonLog.bind(this);

        if (!this._debug) {
            this._bindings.setLogger(this._onAddonLog);
            this._bindings.setLoggerLogLevel(LlamaLogLevelToAddonLogLevel.get(this._logLevel) ?? defaultLogLevel);
        }

        this._bindings.loadBackends();
        const loadedGpu = bindings.getGpuType();
        if (loadedGpu == null || (loadedGpu === false && gpu !== false))
            this._bindings.loadBackends(true);

        this._onExit = this._onExit.bind(this);

        process.on("exit", this._onExit);
    }

    public async dispose() {
        if (this._disposed)
            return;

        this._disposed = true;
        this.onDispose.dispatchEvent();
        await this._backendDisposeGuard.acquireDisposeLock();
        await this._bindings.dispose();
    }

    /** @hidden */
    public async [Symbol.asyncDispose]() {
        await this.dispose();
    }

    public get disposed() {
        return this._disposed;
    }

    public get classes() {
        if (this._classes == null)
            this._classes = getLlamaClasses();

        return this._classes;
    }

    public get gpu() {
        return this._gpu;
    }

    public get supportsGpuOffloading() {
        return this._supportsGpuOffloading;
    }

    public get supportsMmap() {
        return this._supportsMmap;
    }

    public get supportsMlock() {
        return this._supportsMlock;
    }

    /** The number of CPU cores that are useful for math */
    public get cpuMathCores() {
        return this._mathCores;
    }

    /**
     * The maximum number of threads that can be used by the Llama instance.
     *
     * If set to `0`, the Llama instance will have no limit on the number of threads.
     *
     * See the `maxThreads` option of `getLlama` for more information.
     */
    public get maxThreads() {
        return this._threadsSplitter.maxThreads;
    }

    public set maxThreads(value: number) {
        this._threadsSplitter.maxThreads = Math.floor(Math.max(0, value));
    }

    public get logLevel() {
        return this._logLevel;
    }

    public set logLevel(value: LlamaLogLevel) {
        this._ensureNotDisposed();

        if (value === this._logLevel || this._debug)
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
        this._ensureNotDisposed();

        return this._bindings.systemInfo();
    }

    /**
     * VRAM padding used for memory size calculations, as these calculations are not always accurate.
     * This is set by default to ensure stability, but can be configured when you call `getLlama`.
     *
     * See `vramPadding` on `getLlama` for more information.
     */
    public get vramPaddingSize() {
        return this._vramPadding.size;
    }

    /**
     * The total amount of VRAM that is currently being used.
     *
     * `unifiedSize` represents the amount of VRAM that is shared between the CPU and GPU.
     * On SoC devices, this is usually the same as `total`.
     */
    public async getVramState() {
        this._ensureNotDisposed();

        const {total, used, unifiedSize} = this._bindings.getGpuVramInfo();

        return {
            total,
            used,
            free: Math.max(0, total - used),
            unifiedSize
        };
    }

    /**
     * Get the state of the swap memory.
     *
     * **`maxSize`** - The maximum size of the swap memory that the system can allocate.
     * If the swap size is dynamic (like on macOS), this will be `Infinity`.
     *
     * **`allocated`** - The total size allocated by the system for swap memory.
     *
     * **`used`** - The amount of swap memory that is currently being used from the `allocated` size.
     *
     * On Windows, this will return the info for the page file.
     */
    public async getSwapState(): Promise<{
        /**
         * The maximum size of the swap memory that the system can allocate.
         * If the swap size is dynamic (like on macOS), this will be `Infinity`
         */
        maxSize: number,

        /** The total size allocated by the system for swap memory */
        allocated: number,

        /** The amount of swap memory that is currently being used from the `allocated` size */
        used: number
    }> {
        this._ensureNotDisposed();

        const {total, maxSize, free} = this._bindings.getSwapInfo();

        return {
            maxSize: maxSize === -1
                ? Infinity
                : maxSize,
            allocated: total,
            used: total - free
        };
    }

    public async getGpuDeviceNames() {
        this._ensureNotDisposed();

        const {deviceNames} = this._bindings.getGpuDeviceInfo();

        return deviceNames;
    }

    public async loadModel(options: LlamaModelOptions) {
        this._ensureNotDisposed();

        return await withLock(this._memoryLock, LlamaLocks.loadToMemory, options.loadSignal, async () => {
            this._ensureNotDisposed();

            const preventDisposalHandle = this._backendDisposeGuard.createPreventDisposalHandle();
            try {
                return await LlamaModel._create(options, {_llama: this});
            } finally {
                preventDisposalHandle.dispose();
            }
        });
    }

    public async createGrammarForJsonSchema<const T extends GbnfJsonSchema>(schema: Readonly<T>) {
        return new LlamaJsonSchemaGrammar<T>(this, schema);
    }

    public async getGrammarFor(type: Parameters<typeof LlamaGrammar.getFor>[1]) {
        return await LlamaGrammar.getFor(this, type);
    }

    public async createGrammar(options: LlamaGrammarOptions) {
        return new LlamaGrammar(this, options);
    }

    /** @internal */
    public async _init() {
        await this._bindings.init();
    }

    /**
     * Log messages related to the Llama instance
     * @internal
     */
    public _log(level: LlamaLogLevel, message: string) {
        this._onAddonLog(LlamaLogLevelToAddonLogLevel.get(level) ?? defaultLogLevel, message + "\n");
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
                const transformedLogLevel = getTransformedLogLevel(level, message);
                if (LlamaLogLevelGreaterThanOrEqual(transformedLogLevel, this._logLevel))
                    this._logger(transformedLogLevel, message);
            } catch (err) {
                // the native addon code calls this function, so there's no use to throw an error here
            }
        }

        this._previousLog = message;
        this._previousLogLevel = level;
    }

    /** @internal */
    private _onExit() {
        if (this._pendingLog != null && this._pendingLogLevel != null) {
            this._callLogger(this._pendingLogLevel, this._pendingLog);
            this._pendingLog = null;
        }
    }

    /** @internal */
    private _ensureNotDisposed() {
        if (this._disposed)
            throw new DisposedError();
    }

    /** @internal */
    public static async _create({
        bindings, buildType, buildMetadata, logLevel, logger, vramPadding, ramPadding, maxThreads, skipLlamaInit = false, debug
    }: {
        bindings: BindingModule,
        buildType: "localBuild" | "prebuilt",
        buildMetadata: BuildMetadataFile,
        logLevel: LlamaLogLevel,
        logger: (level: LlamaLogLevel, message: string) => void,
        maxThreads?: number,
        vramPadding: number | ((totalVram: number) => number),
        ramPadding: number | ((totalRam: number) => number),
        skipLlamaInit?: boolean,
        debug: boolean
    }) {
        const gpu = bindings.getGpuType() ?? false;
        const vramOrchestrator = new MemoryOrchestrator(() => {
            const {total, used, unifiedSize} = bindings.getGpuVramInfo();

            return {
                total,
                free: Math.max(0, total - used),
                unifiedSize
            };
        });
        const ramOrchestrator = new MemoryOrchestrator(() => {
            const used = process.memoryUsage().rss;
            const total = os.totalmem();

            return {
                total,
                free: Math.max(0, total - used),
                unifiedSize: total
            };
        });
        const swapOrchestrator = new MemoryOrchestrator(() => {
            const {total, maxSize, free} = bindings.getSwapInfo();
            const used = total - free;

            if (maxSize === -1)
                return {
                    total: Infinity,
                    free: Infinity,
                    unifiedSize: Infinity
                };

            return {
                total: maxSize,
                free: maxSize - used,
                unifiedSize: maxSize
            };
        });

        let resolvedVramPadding: MemoryReservation;
        if (gpu === false || vramPadding === 0)
            resolvedVramPadding = vramOrchestrator.reserveMemory(0);
        else if (vramPadding instanceof Function)
            resolvedVramPadding = vramOrchestrator.reserveMemory(vramPadding((await vramOrchestrator.getMemoryState()).total));
        else
            resolvedVramPadding = vramOrchestrator.reserveMemory(vramPadding);

        let resolvedRamPadding: MemoryReservation;
        if (ramPadding instanceof Function)
            resolvedRamPadding = ramOrchestrator.reserveMemory(ramPadding((await ramOrchestrator.getMemoryState()).total));
        else
            resolvedRamPadding = ramOrchestrator.reserveMemory(ramPadding);

        const llama = new Llama({
            bindings,
            buildType,
            cmakeOptions: buildMetadata.buildOptions.customCmakeOptions,
            llamaCppRelease: {
                repo: buildMetadata.buildOptions.llamaCpp.repo,
                release: buildMetadata.buildOptions.llamaCpp.release
            },
            logLevel,
            logger,
            debug,
            gpu,
            vramOrchestrator,
            maxThreads,
            vramPadding: resolvedVramPadding,
            ramOrchestrator,
            ramPadding: resolvedRamPadding,
            swapOrchestrator
        });

        if (!skipLlamaInit)
            await llama._init();

        return llama;
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
            case LlamaLogLevel.log:
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
        case LlamaLogLevel.log: return chalk.white;
        case LlamaLogLevel.debug: return chalk.gray;
        default:
            void (level satisfies never);
            return chalk.whiteBright;
    }
}

function prefixAndColorMessage(message: string, color: (message: string) => string) {
    return getConsoleLogPrefix() + (
        message
            .split("\n")
            .map((line) => color(line))
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

function getTransformedLogLevel(level: LlamaLogLevel, message: string): LlamaLogLevel {
    if (level === LlamaLogLevel.warn && message.endsWith("the full capacity of the model will not be utilized"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("ggml_metal_init: skipping kernel_") && message.endsWith("(not supported)"))
        return LlamaLogLevel.log;
    else if (level === LlamaLogLevel.warn && message.startsWith("ggml_cuda_init: GGML_CUDA_FORCE_") && message.endsWith(" no"))
        return LlamaLogLevel.log;

    return level;
}
