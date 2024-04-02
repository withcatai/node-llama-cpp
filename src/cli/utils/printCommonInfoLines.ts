import bytes from "bytes";
import chalk from "chalk";
import {getPrettyBuildGpuName} from "../../bindings/consts.js";
import {LlamaContext} from "../../evaluator/LlamaContext/LlamaContext.js";
import {printInfoLine} from "./printInfoLine.js";

export function printCommonInfoLines({
    context,
    minTitleLength = 0,
    logBatchSize = false,
    tokenMeterEnabled = false,
    printBos = false,
    printEos = false
}: {
    context: LlamaContext,
    minTitleLength?: number,
    logBatchSize?: boolean,
    tokenMeterEnabled?: boolean,
    printBos?: boolean,
    printEos?: boolean
}) {
    const llama = context._llama;
    const model = context.model;
    const padTitle = Math.max(minTitleLength, "Context".length + 1);

    if (llama.gpu !== false) {
        printInfoLine({
            title: "GPU",
            padTitle: padTitle,
            info: [{
                title: "Type",
                value: getPrettyBuildGpuName(llama.gpu)
            }, {
                title: "VRAM",
                value: bytes(llama.getVramState().total)
            }, {
                title: "Name",
                value: llama.getGpuDeviceNames().join(", ")
            }, {
                title: "GPU layers",
                value: `${model.gpuLayers}/${model.fileInsights.totalLayers} offloaded ${
                    chalk.dim(`(${Math.floor((model.gpuLayers / model.fileInsights.totalLayers) * 100)}%)`)
                }`
            }]
        });
    }
    printInfoLine({
        title: "Model",
        padTitle: padTitle,
        info: [{
            title: "Type",
            value: model.typeDescription
        }, {
            title: "Size",
            value: bytes(model.size)
        }, {
            show: printBos,
            title: "BOS",
            value: () => String(model.tokens.bosString)
        }, {
            show: printEos,
            title: "EOS",
            value: () => String(model.tokens.eosString)
        }, {
            title: "Train context size",
            value: String(model.trainContextSize)
        }]
    });
    printInfoLine({
        title: "Context",
        padTitle: padTitle,
        info: [{
            title: "Size",
            value: String(context.contextSize)
        }, {
            show: logBatchSize,
            title: "Batch size",
            value: bytes(context.batchSize)
        }, {
            show: tokenMeterEnabled,
            title: "Token meter",
            value: "enabled"
        }]
    });
}
