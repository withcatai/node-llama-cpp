import {useCallback, useLayoutEffect, useRef} from "react";
import {llmState} from "../state/llmState.ts";
import {electronLlmRpc} from "../rpc/llmRpc.ts";
import {useExternalState} from "../hooks/useExternalState.ts";
import {SearchIconSVG} from "../icons/SearchIconSVG.tsx";
import {StarIconSVG} from "../icons/StarIconSVG.tsx";
import {DownloadIconSVG} from "../icons/DownloadIconSVG.tsx";
import {Header} from "./components/Header/Header.tsx";
import {ChatHistory} from "./components/ChatHistory/ChatHistory.tsx";
import {InputRow} from "./components/InputRow/InputRow.tsx";

import "./App.css";


export function App() {
    const state = useExternalState(llmState);
    const {generatingResult} = state.chatSession;
    const isScrollAnchoredRef = useRef(false);

    const isScrolledToTheBottom = useCallback(() => {
        return document.documentElement.scrollHeight - document.documentElement.scrollTop === document.documentElement.clientHeight;
    }, []);

    const scrollToBottom = useCallback(() => {
        document.documentElement.scrollTop = document.documentElement.scrollHeight;
        isScrollAnchoredRef.current = isScrolledToTheBottom();
    }, []);

    useLayoutEffect(() => {
        // anchor scroll to bottom

        function onScroll() {
            isScrollAnchoredRef.current = isScrolledToTheBottom();
        }

        const observer = new ResizeObserver(() => {
            if (isScrollAnchoredRef.current && !isScrolledToTheBottom())
                scrollToBottom();
        });

        window.addEventListener("scroll", onScroll, {passive: false});
        observer.observe(document.body, {
            box: "border-box"
        });
        scrollToBottom();

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

        scrollToBottom();
        void electronLlmRpc.prompt(prompt);
    }, [generatingResult, scrollToBottom]);

    const onPromptInput = useCallback((currentText: string) => {
        void electronLlmRpc.setDraftPrompt(currentText);
    }, []);

    const error = state.llama.error ?? state.model.error ?? state.context.error ?? state.contextSequence.error;
    const loading = state.selectedModelFilePath != null && error == null && (
        !state.model.loaded || !state.llama.loaded || !state.context.loaded || !state.contextSequence.loaded || !state.chatSession.loaded
    );
    const showMessage = state.selectedModelFilePath == null || error != null || state.chatSession.simplifiedChat.length === 0;

    return <div className="app">
        <Header
            appVersion={state.appVersion}
            canShowCurrentVersion={state.selectedModelFilePath == null}
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
                    loading &&
                    <div className="loading">
                        Loading...
                    </div>
                }
                {
                    (state.selectedModelFilePath == null || state.llama.error != null) &&
                    <div className="loadModel">
                        <div className="hint">Click the button above to load a model</div>
                        <div className="actions">
                            <a className="starLink" target="_blank" href="https://github.com/withcatai/node-llama-cpp">
                                <StarIconSVG className="starIcon" />
                                <div className="text">
                                    Star <code>node-llama-cpp</code> on GitHub
                                </div>
                            </a>
                            <div className="links">
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text">Get Llama 3.1 8B model</div>
                                </a>
                                <div className="separator" />
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text">Get Gemma 2 2B model</div>
                                </a>
                            </div>
                            <a className="browseLink" target="_blank" href="https://huggingface.co/mradermacher">
                                <SearchIconSVG className="searchIcon" />
                                <div className="text">Find more models</div>
                            </a>
                        </div>
                    </div>
                }
                {
                    (
                        !loading &&
                        state.selectedModelFilePath != null &&
                        error == null &&
                        state.chatSession.simplifiedChat.length === 0
                    ) &&
                    <div className="typeMessage">
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
            disabled={!state.model.loaded || !state.contextSequence.loaded}
            stopGeneration={
                generatingResult
                    ? stopActivePrompt
                    : undefined
            }
            onPromptInput={onPromptInput}
            sendPrompt={sendPrompt}
            generatingResult={generatingResult}
            autocompleteInputDraft={state.chatSession.draftPrompt.prompt}
            autocompleteCompletion={state.chatSession.draftPrompt.completion}
        />
    </div>;
}
