import {parseModelFileName} from "../../utils/parseModelFileName.js";
import {Llama3ChatWrapper} from "../Llama3ChatWrapper.js";
import {Llama2ChatWrapper} from "../Llama2ChatWrapper.js";
import {ChatMLChatWrapper} from "../ChatMLChatWrapper.js";
import {GeneralChatWrapper} from "../GeneralChatWrapper.js";
import {FalconChatWrapper} from "../FalconChatWrapper.js";
import {FunctionaryChatWrapper} from "../FunctionaryChatWrapper.js";
import {AlpacaChatWrapper} from "../AlpacaChatWrapper.js";
import {GemmaChatWrapper} from "../GemmaChatWrapper.js";
import {JinjaTemplateChatWrapper, JinjaTemplateChatWrapperOptions} from "../generic/JinjaTemplateChatWrapper.js";
import {TemplateChatWrapper} from "../generic/TemplateChatWrapper.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";
import {Tokenizer} from "../../types.js";
import {isJinjaTemplateEquivalentToSpecializedChatWrapper} from "./isJinjaTemplateEquivalentToSpecializedChatWrapper.js";
import type {GgufFileInfo} from "../../gguf/types/GgufFileInfoTypes.js";


export const specializedChatWrapperTypeNames = Object.freeze([
    "general", "llama3Chat", "llama2Chat", "alpacaChat", "functionary", "chatML", "falconChat", "gemma"
] as const);
export type SpecializedChatWrapperTypeName = (typeof specializedChatWrapperTypeNames)[number];

export const templateChatWrapperTypeNames = Object.freeze([
    "template", "jinjaTemplate"
] as const);
export type TemplateChatWrapperTypeName = (typeof templateChatWrapperTypeNames)[number];

export const resolvableChatWrapperTypeNames = Object.freeze([
    "auto",
    ...specializedChatWrapperTypeNames,
    ...templateChatWrapperTypeNames
] as const);
export type ResolvableChatWrapperTypeName = (typeof resolvableChatWrapperTypeNames)[number];

const chatWrappers = {
    "general": GeneralChatWrapper,
    "llama3Chat": Llama3ChatWrapper,
    "llama2Chat": Llama2ChatWrapper,
    "alpacaChat": AlpacaChatWrapper,
    "functionary": FunctionaryChatWrapper,
    "chatML": ChatMLChatWrapper,
    "falconChat": FalconChatWrapper,
    "gemma": GemmaChatWrapper,
    "template": TemplateChatWrapper,
    "jinjaTemplate": JinjaTemplateChatWrapper
} as const satisfies Record<SpecializedChatWrapperTypeName | TemplateChatWrapperTypeName, any>;
const chatWrapperToConfigType = new Map(
    Object.entries(chatWrappers)
        .map(([configType, Wrapper]) => (
            [Wrapper, configType as keyof typeof chatWrappers]
        ))
);

export type ResolveChatWrapperOptions = {
    /**
     * Resolve to a specific chat wrapper type.
     * You better not set this option unless you need to force a specific chat wrapper type.
     *
     * Defaults to `"auto"`.
     */
    type?: "auto" | SpecializedChatWrapperTypeName | TemplateChatWrapperTypeName,

    bosString?: string | null,
    filename?: string,
    fileInfo?: GgufFileInfo,
    tokenizer?: Tokenizer,
    customWrapperSettings?: {
        [wrapper in keyof typeof chatWrappers]?: ConstructorParameters<(typeof chatWrappers)[wrapper]>[0]
    },
    warningLogs?: boolean,
    fallbackToOtherWrappersOnJinjaError?: boolean,

    /**
     * Don't resolve to a Jinja chat wrapper unless `type` is set to a Jinja chat wrapper type.
     */
    noJinja?: boolean
};

/**
 * Resolve to a chat wrapper instance based on the provided information.
 * The more information provided, the better the resolution will be (except for `type`).
 *
 * It's recommended to not set `type` to a specific chat wrapper in order for the resolution to be more flexible, but it is useful for when
 * you need to provide the ability to force a specific chat wrapper type.
 * Note that when setting `type` to a generic chat wrapper type (such as `"template"` or `"jinjaTemplate"`), the `customWrapperSettings`
 * must contain the necessary settings for that chat wrapper to be created.
 *
 * When loading a Jinja chat template from either `fileInfo` or `customWrapperSettings.jinjaTemplate.template`,
 * if the chat template format is invalid, it fallbacks to resolve other chat wrappers,
 * unless `fallbackToOtherWrappersOnJinjaError` is set to `false` (in which case, it will throw an error).
 */
export function resolveChatWrapper({
    type = "auto",
    bosString,
    filename,
    fileInfo,
    tokenizer,
    customWrapperSettings,
    warningLogs = true,
    fallbackToOtherWrappersOnJinjaError = true,
    noJinja = false
}: ResolveChatWrapperOptions) {
    function createSpecializedChatWrapper<const T extends typeof chatWrappers[SpecializedChatWrapperTypeName]>(
        specializedChatWrapper: T,
        defaultSettings: ConstructorParameters<T>[0] = {}
    ) {
        const chatWrapperConfigType = chatWrapperToConfigType.get(specializedChatWrapper) as SpecializedChatWrapperTypeName;
        const chatWrapperSettings = customWrapperSettings?.[chatWrapperConfigType];

        return new (specializedChatWrapper as any)({
            ...(defaultSettings ?? {}),
            ...(chatWrapperSettings ?? {})
        });
    }

    if (type !== "auto" && type != null) {
        if (isTemplateChatWrapperType(type)) {
            const Wrapper = chatWrappers[type];

            if (isClassReference(Wrapper, TemplateChatWrapper)) {
                const wrapperSettings = customWrapperSettings?.template;
                if (wrapperSettings == null || wrapperSettings?.template == null || wrapperSettings?.historyTemplate == null ||
                    wrapperSettings?.modelRoleName == null || wrapperSettings?.userRoleName == null
                ) {
                    if (warningLogs)
                        console.warn(getConsoleLogPrefix() + "Template chat wrapper settings must have a template, historyTemplate, modelRoleName, and userRoleName. Falling back to resolve other chat wrapper types.");
                } else
                    return new TemplateChatWrapper(wrapperSettings);
            } else if (isClassReference(Wrapper, JinjaTemplateChatWrapper)) {
                const jinjaTemplate = customWrapperSettings?.jinjaTemplate?.template ?? fileInfo?.metadata?.tokenizer?.chat_template;

                if (jinjaTemplate == null) {
                    if (warningLogs)
                        console.warn(getConsoleLogPrefix() + "Jinja template chat wrapper received no template. Falling back to resolve other chat wrapper types.");
                } else {
                    try {
                        return new JinjaTemplateChatWrapper({
                            ...(customWrapperSettings?.jinjaTemplate ?? {}),
                            template: jinjaTemplate
                        });
                    } catch (err) {
                        if (!fallbackToOtherWrappersOnJinjaError)
                            throw err;
                        else if (warningLogs)
                            console.error(getConsoleLogPrefix() + "Error creating Jinja template chat wrapper. Falling back to resolve other chat wrappers. Error:", err);
                    }
                }
            } else
                void (Wrapper satisfies never);
        } else if (Object.hasOwn(chatWrappers, type)) {
            const Wrapper = chatWrappers[type];
            const wrapperSettings: ConstructorParameters<typeof Wrapper>[0] | undefined =
                customWrapperSettings?.[type];

            return new (Wrapper as any)(wrapperSettings);
        }
    }

    const modelJinjaTemplate = customWrapperSettings?.jinjaTemplate?.template ?? fileInfo?.metadata?.tokenizer?.chat_template;

    if (modelJinjaTemplate != null && modelJinjaTemplate.trim() !== "") {
        const jinjaTemplateChatWrapperOptions: JinjaTemplateChatWrapperOptions = {
            ...(customWrapperSettings?.jinjaTemplate ?? {}),
            template: modelJinjaTemplate
        };

        const chatWrapperNamesToCheck = orderChatWrapperNamesByAssumedCompatibilityWithModel(
            specializedChatWrapperTypeNames,
            {filename, fileInfo}
        );
        for (const specializedChatWrapperTypeName of chatWrapperNamesToCheck) {
            const Wrapper = chatWrappers[specializedChatWrapperTypeName];
            const wrapperSettings = customWrapperSettings?.[specializedChatWrapperTypeName];

            const testOptionConfigurations = Wrapper._getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate?.() ?? [];
            if (testOptionConfigurations.length === 0)
                testOptionConfigurations.push({} as any);

            for (const testConfiguration of testOptionConfigurations) {
                const testChatWrapperSettings = {
                    ...(wrapperSettings ?? {}),
                    ...(testConfiguration ?? {})
                };
                const chatWrapper = new (Wrapper as any)(testChatWrapperSettings);

                if (isJinjaTemplateEquivalentToSpecializedChatWrapper(jinjaTemplateChatWrapperOptions, chatWrapper, tokenizer))
                    return new (Wrapper as any)(testChatWrapperSettings);
            }
        }

        if (!noJinja) {
            if (!fallbackToOtherWrappersOnJinjaError)
                return new JinjaTemplateChatWrapper(jinjaTemplateChatWrapperOptions);

            try {
                return new JinjaTemplateChatWrapper(jinjaTemplateChatWrapperOptions);
            } catch (err) {
                console.error(getConsoleLogPrefix() + "Error creating Jinja template chat wrapper. Falling back to resolve other chat wrappers. Error:", err);
            }
        }
    }

    // try to find a pattern in the Jinja template to resolve to a specialized chat wrapper,
    // with a logic similar to `llama.cpp`'s `llama_chat_apply_template_internal` function
    if (modelJinjaTemplate != null && modelJinjaTemplate.trim() !== "") {
        if (modelJinjaTemplate.includes("<|im_start|>"))
            return createSpecializedChatWrapper(ChatMLChatWrapper);
        else if (modelJinjaTemplate.includes("[INST]"))
            return createSpecializedChatWrapper(Llama2ChatWrapper, {
                addSpaceBeforeEos: modelJinjaTemplate.includes("' ' + eos_token")
            });
        else if (modelJinjaTemplate.includes("<|start_header_id|>") && modelJinjaTemplate.includes("<|end_header_id|>"))
            return createSpecializedChatWrapper(Llama3ChatWrapper);
        else if (modelJinjaTemplate.includes("<start_of_turn>"))
            return createSpecializedChatWrapper(GemmaChatWrapper);
    }

    if (filename != null) {
        const {name, subType, fileType, otherInfo} = parseModelFileName(filename);

        if (fileType?.toLowerCase() === "gguf") {
            const lowercaseName = name?.toLowerCase();
            const lowercaseSubType = subType?.toLowerCase();
            const splitLowercaseSubType = (lowercaseSubType?.split("-") ?? []).concat(
                otherInfo.map(info => info.toLowerCase())
            );
            const firstSplitLowercaseSubType = splitLowercaseSubType[0];

            if (lowercaseName === "llama") {
                if (splitLowercaseSubType.includes("chat"))
                    return createSpecializedChatWrapper(Llama2ChatWrapper);

                return createSpecializedChatWrapper(GeneralChatWrapper);
            } else if (lowercaseName === "codellama")
                return createSpecializedChatWrapper(GeneralChatWrapper);
            else if (lowercaseName === "yarn" && firstSplitLowercaseSubType === "llama")
                return createSpecializedChatWrapper(Llama2ChatWrapper);
            else if (lowercaseName === "orca")
                return createSpecializedChatWrapper(ChatMLChatWrapper);
            else if (lowercaseName === "phind" && lowercaseSubType === "codellama")
                return createSpecializedChatWrapper(Llama2ChatWrapper);
            else if (lowercaseName === "mistral")
                return createSpecializedChatWrapper(GeneralChatWrapper);
            else if (firstSplitLowercaseSubType === "llama")
                return createSpecializedChatWrapper(Llama2ChatWrapper);
            else if (lowercaseSubType === "alpaca")
                return createSpecializedChatWrapper(AlpacaChatWrapper);
            else if (lowercaseName === "functionary")
                return createSpecializedChatWrapper(FunctionaryChatWrapper);
            else if (lowercaseName === "dolphin" && splitLowercaseSubType.includes("mistral"))
                return createSpecializedChatWrapper(ChatMLChatWrapper);
            else if (lowercaseName === "gemma")
                return createSpecializedChatWrapper(GemmaChatWrapper);
            else if (splitLowercaseSubType.includes("chatml"))
                return createSpecializedChatWrapper(ChatMLChatWrapper);
        }
    }

    if (fileInfo != null) {
        const arch = fileInfo.metadata.general?.architecture;

        if (arch === "llama")
            return createSpecializedChatWrapper(GeneralChatWrapper);
        else if (arch === "falcon")
            return createSpecializedChatWrapper(FalconChatWrapper);
    }

    if (bosString === "" || bosString == null)
        return null;

    if ("<s>[INST] <<SYS>>\n".startsWith(bosString)) {
        return createSpecializedChatWrapper(Llama2ChatWrapper);
    } else if ("<|im_start|>system\n".startsWith(bosString)) {
        return createSpecializedChatWrapper(ChatMLChatWrapper);
    }

    return null;
}

export function isSpecializedChatWrapperType(type: string): type is SpecializedChatWrapperTypeName {
    return specializedChatWrapperTypeNames.includes(type as any);
}

export function isTemplateChatWrapperType(type: string): type is TemplateChatWrapperTypeName {
    return templateChatWrapperTypeNames.includes(type as any);
}

// this is needed because TypeScript guards don't work automatically with class references
function isClassReference<T>(value: any, classReference: T): value is T {
    return value === classReference;
}

function orderChatWrapperNamesByAssumedCompatibilityWithModel<T extends ResolvableChatWrapperTypeName>(chatWrapperNames: readonly T[], {
    filename, fileInfo
}: {
    filename?: string,
    fileInfo?: GgufFileInfo
}): readonly T[] {
    const rankPoints = {
        modelName: 3,
        modelNamePosition: 4,
        fileName: 2,
        fileNamePosition: 3
    } as const;

    function getPointsForTextMatch(pattern: string, fullText: string | undefined, existsPoints: number, positionPoints: number) {
        if (fullText == null)
            return 0;

        const index = fullText.toLowerCase().indexOf(pattern.toLowerCase());

        if (index >= 0)
            return existsPoints + (((index + 1) / fullText.length) * positionPoints);

        return 0;
    }

    const modelName = fileInfo?.metadata?.general?.name;

    return chatWrapperNames
        .slice()
        .sort((a, b) => {
            let aPoints = 0;
            let bPoints = 0;

            aPoints += getPointsForTextMatch(a, modelName, rankPoints.modelName, rankPoints.modelNamePosition);
            bPoints += getPointsForTextMatch(b, modelName, rankPoints.modelName, rankPoints.modelNamePosition);

            aPoints += getPointsForTextMatch(a, filename, rankPoints.fileName, rankPoints.fileNamePosition);
            bPoints += getPointsForTextMatch(b, filename, rankPoints.fileName, rankPoints.fileNamePosition);

            return bPoints - aPoints;
        });
}
