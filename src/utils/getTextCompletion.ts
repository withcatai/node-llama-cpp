export function getTextCompletion(text: null, fullText: string | string[]): null;
export function getTextCompletion(text: string, fullText: string | string[]): string | null;
export function getTextCompletion(text: string | null, fullText: string | string[]): string | null;
export function getTextCompletion(text: string | null, fullText: string | string[]): string | null {
    if (text == null) {
        return null;
    }

    const fullTexts = typeof fullText === "string" ? [fullText] : fullText;

    for (const fullText of fullTexts) {
        if (fullText.startsWith(text))
            return fullText.slice(text.length);
    }

    return null;
}
