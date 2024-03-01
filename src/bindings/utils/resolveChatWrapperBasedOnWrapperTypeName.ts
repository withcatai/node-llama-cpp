import {ModelTypeDescription} from "../AddonTypes.js";
import {GeneralChatWrapper} from "../../chatWrappers/GeneralChatWrapper.js";
import {LlamaChatWrapper} from "../../chatWrappers/LlamaChatWrapper.js";
import {AlpacaChatWrapper} from "../../chatWrappers/AlpacaChatWrapper.js";
import {FunctionaryChatWrapper} from "../../chatWrappers/FunctionaryChatWrapper.js";
import {ChatMLChatWrapper} from "../../chatWrappers/ChatMLChatWrapper.js";
import {FalconChatWrapper} from "../../chatWrappers/FalconChatWrapper.js";
import {resolveChatWrapperBasedOnModel} from "../../chatWrappers/resolveChatWrapperBasedOnModel.js";

export const chatWrapperTypeNames = Object.freeze([
    "auto", "general", "llamaChat", "alpacaChat", "functionary", "chatML", "falconChat"
] as const);
export type ChatWrapperTypeName = (typeof chatWrapperTypeNames)[number];

const chatWrappers = {
    "general": GeneralChatWrapper,
    "llamaChat": LlamaChatWrapper,
    "alpacaChat": AlpacaChatWrapper,
    "functionary": FunctionaryChatWrapper,
    "chatML": ChatMLChatWrapper,
    "falconChat": FalconChatWrapper
} as const satisfies Record<Exclude<ChatWrapperTypeName, "auto">, any>;
const chatWrapperToConfigType = new Map(
    Object.entries(chatWrappers).map(([configType, Wrapper]) => [Wrapper, configType])
);

/**
 * @param configType
 * @param options
 */
export function resolveChatWrapperBasedOnWrapperTypeName(configType: ChatWrapperTypeName, {
    bosString,
    filename,
    typeDescription,
    customWrapperSettings
}: {
    bosString?: string | null,
    filename?: string,

    /** @hidden this type alias is too long in the documentation */
    typeDescription?: ModelTypeDescription,

    customWrapperSettings?: {
        [wrapper in keyof typeof chatWrappers]?: ConstructorParameters<(typeof chatWrappers)[wrapper]>[0]
    }
} = {}) {
    if (Object.hasOwn(chatWrappers, configType)) {
        const Wrapper = chatWrappers[configType as keyof typeof chatWrappers];
        const wrapperSettings: ConstructorParameters<typeof Wrapper>[0] | undefined =
            customWrapperSettings?.[configType as keyof typeof chatWrappers];

        return new Wrapper(wrapperSettings);
    }

    if (configType === "auto") {
        const chatWrapper = resolveChatWrapperBasedOnModel({
            bosString,
            filename,
            typeDescription
        });

        if (chatWrapper != null) {
            const resolvedConfigType = chatWrapperToConfigType.get(chatWrapper);
            const wrapperSettings: ConstructorParameters<typeof chatWrapper>[0] | undefined = resolvedConfigType == null
                ? undefined
                : customWrapperSettings?.[resolvedConfigType as keyof typeof chatWrappers];

            return new chatWrapper(wrapperSettings);
        }

        return new GeneralChatWrapper(customWrapperSettings?.general);
    }

    throw new Error("Unknown wrapper config: " + configType);
}
