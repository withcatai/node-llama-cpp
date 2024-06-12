import {useCallback, useMemo, useRef, useState} from "react";
import classNames from "classnames";
import {AddMessageIconSVG} from "../../../icons/AddMessageIconSVG.tsx";
import {AbortIconSVG} from "../../../icons/AbortIconSVG.tsx";

import "./InputRow.css";


export function InputRow({
    disabled = false, stopGeneration, sendPrompt, onPromptInput, autocompleteInputDraft, autocompleteCompletion, generatingResult
}: InputRowProps) {
    const [inputText, setInputText] = useState<string>("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const autocompleteRef = useRef<HTMLDivElement>(null);
    const autocompleteCurrentTextRef = useRef<HTMLDivElement>(null);

    const autocompleteText = useMemo(() => {
        const fullText = (autocompleteInputDraft ?? "") + (autocompleteCompletion ?? "");
        if (fullText.startsWith(inputText))
            return fullText.slice(inputText.length);

        return "";
    }, [inputText, autocompleteInputDraft, autocompleteCompletion]);

    const setInputValue = useCallback((value: string) => {
        if (inputRef.current != null)
            inputRef.current.value = value;

        if (autocompleteCurrentTextRef.current != null)
            autocompleteCurrentTextRef.current.innerText = value;

        setInputText(value);
    }, []);

    const resizeInput = useCallback(() => {
        if (inputRef.current == null)
            return;

        inputRef.current.style.height = "";
        inputRef.current.style.height = inputRef.current.scrollHeight + "px";

        if (autocompleteRef.current != null) {
            autocompleteRef.current.scrollTop = inputRef.current.scrollTop;
        }
    }, []);

    const submitPrompt = useCallback(() => {
        if (generatingResult || inputRef.current == null)
            return;

        const message = inputRef.current.value;
        if (message.length === 0)
            return;

        setInputValue("");
        resizeInput();
        onPromptInput?.("");
        sendPrompt(message);
    }, [setInputValue, generatingResult, resizeInput, sendPrompt, onPromptInput]);

    const onInput = useCallback(() => {
        setInputText(inputRef.current?.value ?? "");
        resizeInput();

        if (autocompleteCurrentTextRef.current != null && inputRef.current != null)
            autocompleteCurrentTextRef.current.innerText = inputRef.current?.value;

        if (inputRef.current != null && onPromptInput != null)
            onPromptInput(inputRef.current?.value);
    }, [resizeInput, onPromptInput]);

    const onInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submitPrompt();
        } else if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (inputRef.current != null && autocompleteText !== "") {
                setInputValue(inputRef.current.value + autocompleteText);
                inputRef.current.scrollTop = inputRef.current.scrollHeight;
                onPromptInput?.(inputRef.current.value);
            }

            resizeInput();
        }
    }, [submitPrompt, setInputValue, onPromptInput, resizeInput, autocompleteText]);

    return <div className={classNames("appInputRow", disabled && "disabled")}>
        <div className="inputContainer">
            <textarea
                ref={inputRef}
                onInput={onInput}
                onKeyDownCapture={onInputKeyDown}
                className="input"
                autoComplete="off"
                spellCheck
                disabled={disabled}
                onScroll={resizeInput}
                placeholder={
                    autocompleteText === ""
                        ? "Type a message..."
                        : ""
                }
            />
            <div className="autocomplete" ref={autocompleteRef}>
                <div className={classNames("content", autocompleteText === "" && "hide")}>
                    <div className="currentText" ref={autocompleteCurrentTextRef}/>
                    <div className="completion">{autocompleteText}</div>
                    <div className="pressTab">Tab</div>
                </div>
            </div>
        </div>
        <button
            className="stopGenerationButton"
            disabled={disabled || stopGeneration == null || !generatingResult}
            onClick={stopGeneration}
        >
            <AbortIconSVG className="icon" />
        </button>
        <button
            className="sendButton"
            disabled={disabled || inputText === "" || generatingResult}
            onClick={submitPrompt}
        >
            <AddMessageIconSVG className="icon" />
        </button>
    </div>;
}

type InputRowProps = {
    disabled?: boolean,
    stopGeneration?(): void,
    sendPrompt(prompt: string): void,
    onPromptInput?(currentText: string): void,
    autocompleteInputDraft?: string,
    autocompleteCompletion?: string,
    generatingResult: boolean
};
