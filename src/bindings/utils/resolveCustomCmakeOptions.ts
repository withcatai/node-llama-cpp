import process from "process";
import {customCmakeOptionsEnvVarPrefix} from "../../config.js";

export function resolveCustomCmakeOptions(customCmakeOptions?: Record<string, string>) {
    const newCustomCmakeOptions: Map<string, string> = customCmakeOptions == null
        ? new Map()
        : new Map(Object.entries(customCmakeOptions));

    if (process.env.GGML_METAL === "1") newCustomCmakeOptions.set("GGML_METAL", "1");
    if (process.env.GGML_METAL_EMBED_LIBRARY === "1") newCustomCmakeOptions.set("GGML_METAL_EMBED_LIBRARY", "1");
    if (process.env.GGML_CUDA === "1") newCustomCmakeOptions.set("GGML_CUDA", "1");
    if (process.env.GGML_VULKAN === "1") newCustomCmakeOptions.set("GGML_VULKAN", "1");

    if (process.env.GGML_OPENBLAS === "1") newCustomCmakeOptions.set("GGML_OPENBLAS", "1");
    if (process.env.GGML_BLAS_VENDOR != null) newCustomCmakeOptions.set("GGML_BLAS_VENDOR", process.env.GGML_BLAS_VENDOR);
    if (process.env.GGML_CUDA_FORCE_DMMV != null) newCustomCmakeOptions.set("GGML_CUDA_FORCE_DMMV", process.env.GGML_CUDA_FORCE_DMMV);
    if (process.env.GGML_CUDA_DMMV_X != null) newCustomCmakeOptions.set("GGML_CUDA_DMMV_X", process.env.GGML_CUDA_DMMV_X);
    if (process.env.GGML_CUDA_MMV_Y != null) newCustomCmakeOptions.set("GGML_CUDA_MMV_Y", process.env.GGML_CUDA_MMV_Y);
    if (process.env.GGML_CUDA_F16 != null) newCustomCmakeOptions.set("GGML_CUDA_F16", process.env.GGML_CUDA_F16);
    if (process.env.GGML_CUDA_KQUANTS_ITER != null) newCustomCmakeOptions.set("GGML_CUDA_KQUANTS_ITER", process.env.GGML_CUDA_KQUANTS_ITER);
    if (process.env.GGML_CUDA_PEER_MAX_BATCH_SIZE != null) newCustomCmakeOptions.set("GGML_CUDA_PEER_MAX_BATCH_SIZE", process.env.GGML_CUDA_PEER_MAX_BATCH_SIZE);
    if (process.env.GGML_HIPBLAS === "1") newCustomCmakeOptions.set("GGML_HIPBLAS", "1");

    for (const key in process.env) {
        if (key.startsWith(customCmakeOptionsEnvVarPrefix) && key !== customCmakeOptionsEnvVarPrefix) {
            const option = key.slice(customCmakeOptionsEnvVarPrefix.length);
            const value = process.env[key];
            newCustomCmakeOptions.set(option, value!);
        }
    }

    newCustomCmakeOptions.delete("");

    return newCustomCmakeOptions;
}
