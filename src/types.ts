export type Token = number & {
    __token: never;
};

export type ConversationInteraction = {
    prompt: string,
    response: string
};
