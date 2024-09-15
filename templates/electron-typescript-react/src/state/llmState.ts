import {State} from "lifecycle-utils";

import {LlmState} from "../../electron/state/llmState.ts";

export const llmState = new State<LlmState>({
    appVersion: undefined,
    llama: {
        loaded: false
    },
    model: {
        loaded: false
    },
    context: {
        loaded: false
    },
    contextSequence: {
        loaded: false
    },
    chatSession: {
        loaded: false,
        generatingResult: false,
        simplifiedChat: [],
        draftPrompt: {
            prompt: "",
            completion: ""
        }
    }
});
