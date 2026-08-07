import type {ShikiTransformer, ShikiTransformerContext} from "shiki";
import type {TwoslashRenderer} from "@shikijs/twoslash/core";

export function createCustomTwoSlashRenderer({
    baseRenderer, transformers
}: {
    baseRenderer: TwoslashRenderer,
    transformers: ShikiTransformer[]
}): TwoslashRenderer {
    function createContext(context: ShikiTransformerContext): ShikiTransformerContext {
        return {
            ...context,
            codeToHast(
                code: Parameters<typeof context.codeToHast>[0],
                options: Parameters<typeof context.codeToHast>[1]
            ) {
                return context.codeToHast(code, {
                    ...options,
                    lang: options.lang.toLowerCase() === "typescript"
                        ? "ts"
                        : options.lang,
                    transformers: [
                        ...(options.transformers ?? []),
                        ...transformers
                    ]
                });
            }
        };
    }

    function wrap<Args extends unknown[], Return>(fn: ((this: ShikiTransformerContext, ...args: Args) => Return)): (
        ((this: ShikiTransformerContext, ...args: Args) => Return)
    );
    function wrap<Args extends unknown[], Return>(fn: ((this: ShikiTransformerContext, ...args: Args) => Return) | undefined): (
        ((this: ShikiTransformerContext, ...args: Args) => Return) | undefined
    );
    function wrap<Args extends unknown[], Return>(method: ((this: ShikiTransformerContext, ...args: Args) => Return) | undefined) {
        if (method == null)
            return undefined;

        return function (this: ShikiTransformerContext, ...args: Args): Return {
            return method.apply(createContext(this), args);
        };
    }

    return Object.fromEntries(
        Object.entries(baseRenderer)
            .map(([key, value]) => [key, wrap(value)] as [typeof key, typeof value])
    ) as TwoslashRenderer;
}

export function preserveTwoslashLanguage(transformer: ShikiTransformer): ShikiTransformer {
    const preprocess = transformer.preprocess;

    return {
        ...transformer,
        preprocess(code, options) {
            const originalLang = options.lang;
            const result = preprocess?.call(this, code, options);
            options.lang = originalLang;

            return result;
        }
    };
}
