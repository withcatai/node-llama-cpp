import {useCallback, useRef, useState} from "react";
import {AddMessageIconSVG} from "../../../icons/AddMessageIconSVG.tsx";
import {AbortIconSVG} from "../../../icons/AbortIconSVG.tsx";

import "./InputRow.css";


export function InputRow({stopGeneration, sendPrompt, generatingResult, contextSequenceLoaded}: InputRowProps) {
    const [inputEmpty, setInputEmpty] = useState(true);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const resizeInput = useCallback(() => {
        if (inputRef.current == null)
            return;

        inputRef.current.style.minHeight = "";
        inputRef.current.style.minHeight = inputRef.current.scrollHeight + "px";
    }, []);

    const submitPrompt = useCallback(() => {
        if (generatingResult || inputRef.current == null)
            return;

        const message = inputRef.current.value;
        if (message.length === 0)
            return;

        inputRef.current.value = "";
        resizeInput();
        sendPrompt(message);
    }, [generatingResult, resizeInput, sendPrompt]);

    const onInput = useCallback(() => {
        setInputEmpty(inputRef.current?.value.length === 0);
        resizeInput();
    }, [resizeInput]);

    const onInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submitPrompt();
            resizeInput();
        }
    }, [submitPrompt]);

    return <div className="appInputRow">
        <textarea
            ref={inputRef}
            onInput={onInput}
            onKeyDown={onInputKeyDown}
            className="input"
            autoComplete="off"
            spellCheck
            disabled={!contextSequenceLoaded}
            placeholder="Type a message..."
        />
        <button
            className="stopGenerationButton"
            disabled={stopGeneration == null || !generatingResult}
            onClick={stopGeneration}
        >
            <AbortIconSVG className="icon" />
        </button>
        <button
            className="sendButton"
            disabled={!contextSequenceLoaded || inputEmpty || generatingResult}
            onClick={submitPrompt}
        >
            <AddMessageIconSVG className="icon" />
        </button>
    </div>;
}

type InputRowProps = {
    stopGeneration?(): void,
    sendPrompt(prompt: string): void,
    generatingResult: boolean,
    contextSequenceLoaded: boolean
};
