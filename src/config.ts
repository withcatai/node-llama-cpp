import {fileURLToPath} from "url";
import * as path from "path";
import * as os from "os";
import process from "process";
import envVar from "env-var";
import {nanoid} from "nanoid";
import {getBinariesGithubRelease} from "./bindings/utils/binariesGithubRelease.js";
import {
    nodeLlamaCppGpuOptions, LlamaLogLevel, LlamaLogLevelValues, parseNodeLlamaCppGpuOption, nodeLlamaCppGpuOffStringOptions
} from "./bindings/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = envVar.from(process.env);


export const llamaDirectory = path.join(__dirname, "..", "llama");
export const llamaToolchainsDirectory = path.join(llamaDirectory, "toolchains");
export const llamaPrebuiltBinsDirectory = path.join(__dirname, "..", "bins");
export const llamaLocalBuildBinsDirectory = path.join(llamaDirectory, "localBuilds");
export const llamaBinsGrammarsDirectory = path.join(__dirname, "..", "llama", "grammars");
export const projectTemplatesDirectory = path.join(__dirname, "..", "templates");
export const packedProjectTemplatesDirectory = path.join(projectTemplatesDirectory, "packed");
export const llamaCppDirectory = path.join(llamaDirectory, "llama.cpp");
export const llamaCppGrammarsDirectory = path.join(llamaDirectory, "llama.cpp", "grammars");
export const tempDownloadDirectory = path.join(os.tmpdir(), "node-llama-cpp", nanoid());
export const cliHomedirDirectory = path.join(os.homedir(), ".node-llama-cpp");
export const chatCommandHistoryFilePath = path.join(cliHomedirDirectory, ".chat_repl_history");
export const cliModelsDirectory = path.join(cliHomedirDirectory, "models");
export const lastBuildInfoJsonPath = path.join(llamaDirectory, "lastBuild.json");
export const binariesGithubReleasePath = path.join(llamaDirectory, "binariesGithubRelease.json");
export const llamaCppDirectoryInfoFilePath = path.join(llamaDirectory, "llama.cpp.info.json");
export const currentReleaseGitBundlePath = path.join(llamaDirectory, "gitRelease.bundle");
export const xpackDirectory = path.join(llamaDirectory, "xpack");
export const localXpacksStoreDirectory = path.join(xpackDirectory, "store");
export const localXpacksCacheDirectory = path.join(xpackDirectory, "cache");
export const buildMetadataFileName = "_nlcBuildMetadata.json";
export const xpmVersion = "^0.16.3";
export const builtinLlamaCppGitHubRepo = "ggml-org/llama.cpp";
export const builtinLlamaCppRelease = await getBinariesGithubRelease();

export const isCI = env.get("CI")
    .default("false")
    .asBool();
export const isRunningInsideGoogleColab = env.get("COLAB_RELEASE_TAG")
    .default("")
    .asString() !== "";
export const useCiLogs = isCI || isRunningInsideGoogleColab;
export const defaultLlamaCppGitHubRepo = env.get("NODE_LLAMA_CPP_REPO")
    .default(builtinLlamaCppGitHubRepo)
    .asString();
export const defaultLlamaCppRelease = env.get("NODE_LLAMA_CPP_REPO_RELEASE")
    .default(builtinLlamaCppRelease)
    .asString();
export const defaultLlamaCppGpuSupport = parseNodeLlamaCppGpuOption(
    env.get("NODE_LLAMA_CPP_GPU")
        .default("auto")
        .asEnum(
            nodeLlamaCppGpuOptions
                .flatMap((option) => (
                    option === false
                        ? nodeLlamaCppGpuOffStringOptions
                        : [option]
                ))
        )
);
export const defaultLlamaCppLogLevel = env.get("NODE_LLAMA_CPP_LOG_LEVEL")
    .default(LlamaLogLevel.warn)
    .asEnum(LlamaLogLevelValues);
export const defaultLlamaCppDebugMode = env.get("NODE_LLAMA_CPP_DEBUG")
    .default("false")
    .asBool();
export const defaultSkipDownload = env.get("NODE_LLAMA_CPP_SKIP_DOWNLOAD")
    .default("false")
    .asBool();
export const defaultXpacksStoreDirectory = env.get("NODE_LLAMA_CPP_XPACKS_STORE_FOLDER")
    .default(localXpacksStoreDirectory)
    .asString();
export const defaultXpacksCacheDirectory = env.get("NODE_LLAMA_CPP_XPACKS_CACHE_FOLDER")
    .default(localXpacksCacheDirectory)
    .asString();
export const customCmakeOptionsEnvVarPrefix = "NODE_LLAMA_CPP_CMAKE_OPTION_";
export const defaultChatSystemPrompt = "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.\n" +
    "If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrectly. " +
    "If you don't know the answer to a question, don't share false information.";
export const cliBinName = "node-llama-cpp";
export const npxRunPrefix = "npx --no ";

// No need for that at the moment.
// Disabled due to a recursive clone of the llama.cpp repo taking up a lot of space (in the embedded bundle)
// and due to making the clone significantly slower.
// The submodules of the repo are not being used for the compilation for the supported backends, so there's no need to clone them.
export const enableRecursiveClone = false;

const documentationUrl = "https://node-llama-cpp.withcat.ai";
const documentationCliUrl = documentationUrl + "/cli";
export const documentationPageUrls = {
    CUDA: documentationUrl + "/guide/CUDA",
    Vulkan: documentationUrl + "/guide/vulkan",
    CLI: {
        index: documentationCliUrl,
        Pull: documentationCliUrl + "/pull",
        Chat: documentationCliUrl + "/chat",
        Init: documentationCliUrl + "/init",
        Complete: documentationCliUrl + "/complete",
        Infill: documentationCliUrl + "/infill",
        Inspect: {
            index: documentationCliUrl + "/inspect",
            GPU: documentationCliUrl + "/inspect/gpu",
            GGUF: documentationCliUrl + "/inspect/gguf",
            Measure: documentationCliUrl + "/inspect/measure",
            Estimate: documentationCliUrl + "/inspect/estimate"
        },
        Source: {
            index: documentationCliUrl + "/source",
            Download: documentationCliUrl + "/source/download",
            Build: documentationCliUrl + "/source/build",
            Clear: documentationCliUrl + "/source/clear"
        }
    },
    troubleshooting: {
        RosettaIllegalHardwareInstruction: documentationUrl + "/guide/troubleshooting#illegal-hardware-instruction"
    }
} as const;
export const newGithubIssueUrl = "https://github.com/withcatai/node-llama-cpp/issues";
export const recommendedBaseDockerImage = "node:20";
export const minAllowedContextSizeInCalculations = 24;
