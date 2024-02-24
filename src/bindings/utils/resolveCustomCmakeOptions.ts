import process from "process";
import {customCmakeOptionsEnvVarPrefix} from "../../config.js";

export function resolveCustomCmakeOptions(customCmakeOptions?: Record<string, string>) {
    const newCustomCmakeOptions: Map<string, string> = customCmakeOptions == null
        ? new Map()
        : new Map(Object.entries(customCmakeOptions));

    if (process.env.LLAMA_METAL === "1") newCustomCmakeOptions.set("LLAMA_METAL", "1");
    if (process.env.LLAMA_CUBLAS === "1") newCustomCmakeOptions.set("LLAMA_CUBLAS", "1");
    if (process.env.LLAMA_VULKAN === "1") newCustomCmakeOptions.set("LLAMA_VULKAN", "1");

    if (process.env.LLAMA_MPI === "1") newCustomCmakeOptions.set("LLAMA_MPI", "1");
    if (process.env.LLAMA_OPENBLAS === "1") newCustomCmakeOptions.set("LLAMA_OPENBLAS", "1");
    if (process.env.LLAMA_BLAS_VENDOR != null) newCustomCmakeOptions.set("LLAMA_BLAS_VENDOR", process.env.LLAMA_BLAS_VENDOR);
    if (process.env.LLAMA_CUDA_FORCE_DMMV != null) newCustomCmakeOptions.set("LLAMA_CUDA_FORCE_DMMV", process.env.LLAMA_CUDA_FORCE_DMMV);
    if (process.env.LLAMA_CUDA_DMMV_X != null) newCustomCmakeOptions.set("LLAMA_CUDA_DMMV_X", process.env.LLAMA_CUDA_DMMV_X);
    if (process.env.LLAMA_CUDA_MMV_Y != null) newCustomCmakeOptions.set("LLAMA_CUDA_MMV_Y", process.env.LLAMA_CUDA_MMV_Y);
    if (process.env.LLAMA_CUDA_F16 != null) newCustomCmakeOptions.set("LLAMA_CUDA_F16", process.env.LLAMA_CUDA_F16);
    if (process.env.LLAMA_CUDA_KQUANTS_ITER != null) newCustomCmakeOptions.set("LLAMA_CUDA_KQUANTS_ITER", process.env.LLAMA_CUDA_KQUANTS_ITER);
    if (process.env.LLAMA_CUDA_PEER_MAX_BATCH_SIZE != null) newCustomCmakeOptions.set("LLAMA_CUDA_PEER_MAX_BATCH_SIZE", process.env.LLAMA_CUDA_PEER_MAX_BATCH_SIZE);
    if (process.env.LLAMA_HIPBLAS === "1") newCustomCmakeOptions.set("LLAMA_HIPBLAS", "1");
    if (process.env.LLAMA_CLBLAST === "1") newCustomCmakeOptions.set("LLAMA_CLBLAST", "1");

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
