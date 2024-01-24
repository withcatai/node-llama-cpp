import {fileURLToPath} from "url";
import * as path from "path";
import * as os from "os";
import process from "process";
import envVar from "env-var";
import * as uuid from "uuid";
import {getBinariesGithubRelease} from "./utils/binariesGithubRelease.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = envVar.from(process.env);


export const llamaDirectory = path.join(__dirname, "..", "llama");
export const llamaToolchainsDirectory = path.join(llamaDirectory, "toolchains");
export const llamaBinsDirectory = path.join(__dirname, "..", "llamaBins");
export const llamaBinsGrammarsDirectory = path.join(__dirname, "..", "llama", "grammars");
export const llamaCppDirectory = path.join(llamaDirectory, "llama.cpp");
export const llamaCppGrammarsDirectory = path.join(llamaDirectory, "llama.cpp", "grammars");
export const tempDownloadDirectory = path.join(os.tmpdir(), "node-llama-cpp", uuid.v4());
export const chatCommandHistoryFilePath = path.join(os.homedir(), ".node-llama-cpp.chat_repl_history");
export const usedBinFlagJsonPath = path.join(llamaDirectory, "usedBin.json");
export const binariesGithubReleasePath = path.join(llamaDirectory, "binariesGithubRelease.json");
export const llamaCppDirectoryTagFilePath = path.join(llamaDirectory, "llama.cpp.tag.json");
export const currentReleaseGitBundlePath = path.join(llamaDirectory, "gitRelease.bundle");
export const xpackDirectory = path.join(llamaDirectory, "xpack");
export const localXpacksStoreDirectory = path.join(xpackDirectory, "store");
export const localXpacksCacheDirectory = path.join(xpackDirectory, "cache");
export const xpmVersion = "^0.16.3";

export const isCI = env.get("CI")
    .default("false")
    .asBool();
export const defaultLlamaCppGitHubRepo = env.get("NODE_LLAMA_CPP_REPO")
    .default("ggerganov/llama.cpp")
    .asString();
export const defaultLlamaCppRelease = env.get("NODE_LLAMA_CPP_REPO_RELEASE")
    .default(await getBinariesGithubRelease())
    .asString();
export const defaultLlamaCppMetalSupport = env.get("NODE_LLAMA_CPP_METAL")
    .default(process.platform === "darwin" ? "true" : "false")
    .asBool();
export const defaultLlamaCppCudaSupport = env.get("NODE_LLAMA_CPP_CUDA")
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
    "If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. " +
    "If you don't know the answer to a question, please don't share false information.";
export const cliBinName = "node-llama-cpp";
export const npxRunPrefix = "npx --no ";

const documentationUrl = "https://withcatai.github.io/node-llama-cpp";
export const documentationPageUrls = {
    CUDA: documentationUrl + "/guide/CUDA"
} as const;
