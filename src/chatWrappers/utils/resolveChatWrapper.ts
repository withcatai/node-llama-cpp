import {parseModelFileName} from "../../utils/parseModelFileName.js";
import {LlamaChatWrapper} from "../LlamaChatWrapper.js";
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
    "general", "llamaChat", "alpacaChat", "functionary", "chatML", "falconChat", "gemma"
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
    "llamaChat": LlamaChatWrapper,
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
    fallbackToOtherWrappersOnJinjaError?: boolean
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
    fallbackToOtherWrappersOnJinjaError = true
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

        for (const specializedChatWrapperTypeName of specializedChatWrapperTypeNames) {
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

        if (!fallbackToOtherWrappersOnJinjaError)
            return new JinjaTemplateChatWrapper(jinjaTemplateChatWrapperOptions);

        try {
            return new JinjaTemplateChatWrapper(jinjaTemplateChatWrapperOptions);
        } catch (err) {
            console.error(getConsoleLogPrefix() + "Error creating Jinja template chat wrapper. Falling back to resolve other chat wrappers. Error:", err);
        }
    }

    // try to find a pattern in the Jinja template to resolve to a specialized chat wrapper,
    // with a logic similar to `llama.cpp`'s `llama_chat_apply_template_internal` function
    if (modelJinjaTemplate != null && modelJinjaTemplate.trim() !== "") {
        if (modelJinjaTemplate.includes("<|im_start|>"))
            return createSpecializedChatWrapper(ChatMLChatWrapper);
        else if (modelJinjaTemplate.includes("[INST]"))
            return createSpecializedChatWrapper(LlamaChatWrapper, {
                addSpaceBeforeEos: modelJinjaTemplate.includes("' ' + eos_token")
            });
        else if (modelJinjaTemplate.includes("<start_of_turn>"))
            return createSpecializedChatWrapper(GemmaChatWrapper);
    }

    if (filename != null) {
        const {name, subType, fileType} = parseModelFileName(filename);

        if (fileType?.toLowerCase() === "gguf") {
            const lowercaseName = name?.toLowerCase();
            const lowercaseSubType = subType?.toLowerCase();
            const splitLowercaseSubType = lowercaseSubType?.split("-") ?? [];
            const firstSplitLowercaseSubType = splitLowercaseSubType[0];

            if (lowercaseName === "llama") {
                if (splitLowercaseSubType.includes("chat"))
                    return createSpecializedChatWrapper(LlamaChatWrapper);

                return createSpecializedChatWrapper(GeneralChatWrapper);
            } else if (lowercaseName === "yarn" && firstSplitLowercaseSubType === "llama")
                return createSpecializedChatWrapper(LlamaChatWrapper);
            else if (lowercaseName === "orca")
                return createSpecializedChatWrapper(ChatMLChatWrapper);
            else if (lowercaseName === "phind" && lowercaseSubType === "codellama")
                return createSpecializedChatWrapper(LlamaChatWrapper);
            else if (lowercaseName === "mistral")
                return createSpecializedChatWrapper(GeneralChatWrapper);
            else if (firstSplitLowercaseSubType === "llama")
                return createSpecializedChatWrapper(LlamaChatWrapper);
            else if (lowercaseSubType === "alpaca")
                return createSpecializedChatWrapper(AlpacaChatWrapper);
            else if (lowercaseName === "functionary")
                return createSpecializedChatWrapper(FunctionaryChatWrapper);
            else if (lowercaseName === "dolphin" && splitLowercaseSubType.includes("mistral"))
                return createSpecializedChatWrapper(ChatMLChatWrapper);
            else if (lowercaseName === "gemma")
                return createSpecializedChatWrapper(GemmaChatWrapper);
        }
    }

    if (fileInfo != null) {
        const arch = fileInfo.metadata.general?.architecture;

        if (arch === "llama")
            return createSpecializedChatWrapper(LlamaChatWrapper);
        else if (arch === "falcon")
            return createSpecializedChatWrapper(FalconChatWrapper);
    }

    if (bosString === "" || bosString == null)
        return null;

    if ("<s>[INST] <<SYS>>\n".startsWith(bosString)) {
        return createSpecializedChatWrapper(LlamaChatWrapper);
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
