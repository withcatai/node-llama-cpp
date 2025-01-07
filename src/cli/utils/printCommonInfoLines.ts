import chalk from "chalk";
import {getPrettyBuildGpuName} from "../../bindings/consts.js";
import {LlamaContext} from "../../evaluator/LlamaContext/LlamaContext.js";
import {printInfoLine} from "./printInfoLine.js";
import {toBytes} from "./toBytes.js";

export async function printCommonInfoLines({
    context,
    draftContext,
    minTitleLength = 0,
    useMmap,
    logBatchSize = false,
    tokenMeterEnabled = false,
    printBos = false,
    printEos = false
}: {
    context: LlamaContext,
    draftContext?: LlamaContext,
    minTitleLength?: number,
    useMmap?: boolean,
    logBatchSize?: boolean,
    tokenMeterEnabled?: boolean,
    printBos?: boolean,
    printEos?: boolean
}) {
    const llama = context._llama;
    const model = context.model;
    const padTitle = Math.max(
        minTitleLength,
        "Context".length + 1,
        draftContext != null
            ? ("Draft context".length + 1)
            : 0
    );

    if (llama.gpu !== false) {
        const [
            vramState,
            deviceNames
        ] = await Promise.all([
            llama.getVramState(),
            llama.getGpuDeviceNames()
        ]);

        printInfoLine({
            title: "GPU",
            padTitle: padTitle,
            info: [{
                title: "Type",
                value: getPrettyBuildGpuName(llama.gpu)
            }, {
                title: "VRAM",
                value: toBytes(vramState.total)
            }, {
                title: "Name",
                value: toOneLine(deviceNames.join(", "))
            }]
        });
    }
    printInfoLine({
        title: "Model",
        padTitle: padTitle,
        info: [{
            title: "Type",
            value: toOneLine(model.typeDescription)
        }, {
            title: "Size",
            value: toBytes(model.size)
        }, {
            show: llama.gpu !== false,
            title: "GPU layers",
            value: `${model.gpuLayers}/${model.fileInsights.totalLayers} offloaded ${
                chalk.dim(`(${Math.floor((model.gpuLayers / model.fileInsights.totalLayers) * 100)}%)`)
            }`
        }, {
            title: "mmap",
            value: !model._llama.supportsMmap
                ? "unsupported"
                : (useMmap || useMmap == null)
                    ? "enabled"
                    : "disabled"
        }, {
            show: printBos,
            title: "BOS",
            value: () => toOneLine(String(model.tokens.bosString))
        }, {
            show: printEos,
            title: "EOS",
            value: () => toOneLine(String(model.tokens.eosString))
        }, {
            title: "Train context size",
            value: model.trainContextSize.toLocaleString("en-US")
        }]
    });
    printInfoLine({
        title: "Context",
        padTitle: padTitle,
        info: [{
            title: "Size",
            value: context.contextSize.toLocaleString("en-US")
        }, {
            title: "Threads",
            value: context.currentThreads.toLocaleString("en-US")
        }, {
            show: logBatchSize,
            title: "Batch size",
            value: context.batchSize.toLocaleString("en-US")
        }, {
            show: context.flashAttention,
            title: "Flash attention",
            value: "enabled"
        }, {
            show: tokenMeterEnabled,
            title: "Token meter",
            value: "enabled"
        }]
    });

    if (draftContext != null) {
        const draftModel = draftContext.model;

        printInfoLine({
            title: "Draft model",
            padTitle: padTitle,
            info: [{
                title: "Type",
                value: toOneLine(draftModel.typeDescription)
            }, {
                title: "Size",
                value: toBytes(draftModel.size)
            }, {
                show: llama.gpu !== false,
                title: "GPU layers",
                value: `${draftModel.gpuLayers}/${draftModel.fileInsights.totalLayers} offloaded ${
                    chalk.dim(`(${Math.floor((draftModel.gpuLayers / draftModel.fileInsights.totalLayers) * 100)}%)`)
                }`
            }, {
                show: printBos,
                title: "BOS",
                value: () => toOneLine(String(draftModel.tokens.bosString))
            }, {
                show: printEos,
                title: "EOS",
                value: () => toOneLine(String(draftModel.tokens.eosString))
            }, {
                title: "Train context size",
                value: draftModel.trainContextSize.toLocaleString("en-US")
            }]
        });
        printInfoLine({
            title: "Draft context",
            padTitle: padTitle,
            info: [{
                title: "Size",
                value: draftContext.contextSize.toLocaleString("en-US")
            }, {
                title: "Threads",
                value: draftContext.currentThreads.toLocaleString("en-US")
            }, {
                show: logBatchSize,
                title: "Batch size",
                value: draftContext.batchSize.toLocaleString("en-US")
            }, {
                show: draftContext.flashAttention,
                title: "Flash attention",
                value: "enabled"
            }, {
                show: tokenMeterEnabled,
                title: "Token meter",
                value: "enabled"
            }]
        });
    }

    return padTitle;
}

function toOneLine(text: string) {
    return text.replaceAll("\n", chalk.gray("\\n"));
}
