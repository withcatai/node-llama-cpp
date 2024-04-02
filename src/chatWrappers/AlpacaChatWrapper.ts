import {GeneralChatWrapper} from "./GeneralChatWrapper.js";

export class AlpacaChatWrapper extends GeneralChatWrapper {
    public override readonly wrapperName: string = "AlpacaChat";

    public constructor({
        userMessageTitle = "Instruction", modelResponseTitle = "Response", middleSystemMessageTitle = "System",
        allowSpecialTokensInTitles = false
    }: {
        userMessageTitle?: string, modelResponseTitle?: string, middleSystemMessageTitle?: string, allowSpecialTokensInTitles?: boolean
    } = {}) {
        super({
            userMessageTitle: userMessageTitle + ":",
            modelResponseTitle: modelResponseTitle + ":",
            middleSystemMessageTitle: middleSystemMessageTitle + ":",
            allowSpecialTokensInTitles
        });
    }

    public override get userMessageTitle() {
        return super.userMessageTitle.slice(0, -1);
    }

    public override get modelResponseTitle() {
        return super.modelResponseTitle.slice(0, -1);
    }

    public override get middleSystemMessageTitle() {
        return super.middleSystemMessageTitle.slice(0, -1);
    }

    /** @internal */
    public static override _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate() {
        return [{}, {
            allowSpecialTokensInTitles: true
        }] satisfies Partial<ConstructorParameters<typeof this>[0]>[];
    }
}
