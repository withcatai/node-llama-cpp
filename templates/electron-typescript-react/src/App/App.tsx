import {useCallback, useLayoutEffect} from "react";
import {llmState} from "../state/llmState.ts";
import {electronLlmRpc} from "../rpc/llmRpc.ts";
import {useExternalState} from "../hooks/useExternalState.ts";
import {Header} from "./components/Header/Header.tsx";
import {ChatHistory} from "./components/ChatHistory/ChatHistory.tsx";
import {InputRow} from "./components/InputRow/InputRow.tsx";

import "./App.css";


export function App() {
    const state = useExternalState(llmState);
    const {generatingResult} = state.chatSession;

    useLayoutEffect(() => {
        // anchor scroll to bottom

        let isAnchored = false;
        function isAtTheBottom() {
            return document.documentElement.scrollHeight - document.documentElement.scrollTop === document.documentElement.clientHeight;
        }

        function scrollToBottom() {
            document.documentElement.scrollTop = document.documentElement.scrollHeight;
        }

        function onScroll() {
            isAnchored = isAtTheBottom();
        }

        const observer = new ResizeObserver(() => {
            if (isAnchored && !isAtTheBottom())
                scrollToBottom();
        });

        window.addEventListener("scroll", onScroll, {passive: false});
        observer.observe(document.body, {
            box: "border-box"
        });
        scrollToBottom();
        isAnchored = isAtTheBottom();

        return () => {
            observer.disconnect();
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

    const openSelectModelFileDialog = useCallback(async () => {
        await electronLlmRpc.selectModelFileAndLoad();
    }, []);

    const stopActivePrompt = useCallback(() => {
        void electronLlmRpc.stopActivePrompt();
    }, []);

    const resetChatHistory = useCallback(() => {
        void electronLlmRpc.stopActivePrompt();
        void electronLlmRpc.resetChatHistory();
    }, []);

    const sendPrompt = useCallback((prompt: string) => {
        if (generatingResult)
            return;

        void electronLlmRpc.prompt(prompt);
    }, [generatingResult]);

    const onPromptInput = useCallback((currentText: string) => {
        void electronLlmRpc.setDraftPrompt(currentText);
    }, []);

    const error = state.llama.error ?? state.model.error ?? state.context.error ?? state.contextSequence.error;
    const showMessage = state.selectedModelFilePath == null || error != null || state.chatSession.simplifiedChat.length === 0;

    return <div className="app">
        <Header
            modelName={state.model.name}
            loadPercentage={state.model.loadProgress}
            onLoadClick={openSelectModelFileDialog}
            onResetChatClick={
                !showMessage
                    ? resetChatHistory
                    : undefined
            }
        />
        {
            showMessage &&
            <div className="message">
                {
                    error != null &&
                    <div className="error">
                        {String(error)}
                    </div>
                }
                {
                    (state.selectedModelFilePath == null || state.llama.error != null) &&
                    <div className="loadModel">
                        Click the button above to load a model
                    </div>
                }
                {
                    (
                        state.selectedModelFilePath != null &&
                        error == null &&
                        state.chatSession.simplifiedChat.length === 0
                    ) &&
                    <div className="loadModel">
                        Type a message to start the conversation
                    </div>
                }
            </div>
        }
        {
            !showMessage &&
            <ChatHistory
                simplifiedChat={state.chatSession.simplifiedChat}
                generatingResult={generatingResult}
            />
        }
        <InputRow
            stopGeneration={
                generatingResult
                    ? stopActivePrompt
                    : undefined
            }
            onPromptInput={onPromptInput}
            sendPrompt={sendPrompt}
            generatingResult={generatingResult}
            contextSequenceLoaded={state.contextSequence.loaded}
            autocompleteInputDraft={state.chatSession.draftPrompt.prompt}
            autocompleteCompletion={state.chatSession.draftPrompt.completion}
        />
    </div>;
}
