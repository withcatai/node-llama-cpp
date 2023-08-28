import {fileURLToPath} from "url";
import * as path from "path";
import * as os from "os";
import envVar from "env-var";
import * as uuid from "uuid";
import {getBinariesGithubRelease} from "./utils/binariesGithubRelease.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = envVar.from(process.env);


export const llamaDirectory = path.join(__dirname, "..", "llama");
export const llamaBinsDirectory = path.join(__dirname, "..", "llamaBins");
export const llamaBinsGrammarsDirectory = path.join(__dirname, "..", "llama", "grammars");
export const llamaCppDirectory = path.join(llamaDirectory, "llama.cpp");
export const llamaCppGrammarsDirectory = path.join(llamaDirectory, "llama.cpp", "grammars");
export const tempDownloadDirectory = path.join(os.tmpdir(), "node-llama-cpp", uuid.v4());
export const usedBinFlagJsonPath = path.join(llamaDirectory, "usedBin.json");
export const binariesGithubReleasePath = path.join(llamaDirectory, "binariesGithubRelease.json");

export const defaultLlamaCppGitHubRepo = env.get("NODE_LLAMA_CPP_REPO")
    .default("ggerganov/llama.cpp")
    .asString();
export const defaultLlamaCppRelease = env.get("NODE_LLAMA_CPP_REPO_RELEASE")
    .default(await getBinariesGithubRelease())
    .asString();
export const defaultLlamaCppMetalSupport = env.get("NODE_LLAMA_CPP_METAL")
    .default("false")
    .asBool();
export const defaultLlamaCppCudaSupport = env.get("NODE_LLAMA_CPP_CUDA")
    .default("false")
    .asBool();
export const defaultSkipDownload = env.get("NODE_LLAMA_CPP_SKIP_DOWNLOAD")
    .default("false")
    .asBool();
export const defaultChatSystemPrompt = "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible.\n" +
    "If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. " +
    "If you don't know the answer to a question, please don't share false information.";
