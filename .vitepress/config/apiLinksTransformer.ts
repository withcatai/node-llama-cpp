/* eslint import/no-unresolved: "off" */
import typedocSidebar from "../../docs/api/typedoc-sidebar.json";
import type {ShikiTransformer} from "shiki";
import type {Element} from "hast";


const apiSymbolLinks = typedocSidebarToSymbolMap();

const typeDocMemberModifiers = [
    "public", "protected", "private", "static", "abstract", "readonly", "override", "declare", "optional"
] as const;
const typeDocMemberModifiersRegex = typeDocMemberModifiers.join("|");
const tsMemberModifiersRegex = ["public", "protected", "private", "static", "abstract", "readonly", "override", "declare"].join("|");
const optionalModifierRegex = new RegExp(`^([\\t ]*(?:(?:${tsMemberModifiersRegex})[\\t ]+)*)optional(?=[\\t ])`, "gm");

export function apiTypeLinksTransformer({
    resolveHref
}: {
    resolveHref(href: string, withDomain?: boolean): string
}): ShikiTransformer {
    const enabled = new WeakSet<object>();
    const originalCode = new WeakMap<object, string>();
    const qualifiedSymbolLinks = new WeakMap<object, Map<string, string>>();
    const signaturePrefixes = new WeakMap<object, Map<number, {
        column: number,
        content: string,
        typeName?: string,
        href?: string
    }[]>>();

    return {
        name: "api-type-links",
        enforce: "pre",

        preprocess(code, options) {
            if (options.lang.toLowerCase() !== "ts")
                return;

            enabled.add(this.meta);

            options.includeExplanation = "scopeName";
            options.mergeWhitespaces = "never";

            const links = getQualifiedSymbolLinks(code);
            if (links.size > 0)
                qualifiedSymbolLinks.set(this.meta, links);

            const normalizedSignature = normalizeTypeDocSignature(code);
            if (normalizedSignature != null) {
                options.grammarContextCode = "declare interface __TypeDoc {\n";

                originalCode.set(this.meta, code);
                signaturePrefixes.set(this.meta, normalizedSignature.prefixes);

                return normalizedSignature.code.replace(
                    optionalModifierRegex,
                    "$1abstract"
                );
            }

            if (looksLikeTypeDocMember(code)) {
                options.grammarContextCode = "declare class __TypeDoc {\n";

                originalCode.set(this.meta, code);

                return code.replace(
                    optionalModifierRegex,
                    "$1abstract"
                );
            }

            return;
        },

        tokens(tokens) {
            if (!enabled.has(this.meta))
                return;

            const links = qualifiedSymbolLinks.get(this.meta);
            const prefixes = signaturePrefixes.get(this.meta);

            if (links == null && prefixes == null)
                return;

            return tokens.map((line, lineIndex) => {
                let column = 0;

                return line.flatMap((token) => {
                    const tokenColumn = column;
                    column += token.content.length;

                    const signaturePrefix = prefixes?.get(lineIndex + 1)?.find((prefix) => (
                        tokenColumn <= prefix.column &&
                        tokenColumn + token.content.length >= prefix.column + prefix.content.length
                    ));

                    if (signaturePrefix != null) {
                        const prefixOffset = signaturePrefix.column - tokenColumn;
                        const prefixEnd = prefixOffset + signaturePrefix.content.length;
                        const result: typeof line = [];

                        if (prefixOffset > 0)
                            result.push({
                                ...token,
                                content: token.content.slice(0, prefixOffset)
                            });

                        if (signaturePrefix.typeName != null) {
                            const typeStyleToken = line.find((otherToken) => (
                                otherToken.content === signaturePrefix.typeName &&
                                otherToken !== token &&
                                isTypeToken(otherToken)
                            )) ?? line.find(isTypeToken);

                            result.push({
                                ...(typeStyleToken ?? token),
                                content: signaturePrefix.typeName,
                                offset: token.offset + prefixOffset
                            });

                            const remainingPrefix = signaturePrefix.content.slice(signaturePrefix.typeName.length);
                            if (remainingPrefix !== "")
                                result.push({
                                    ...token,
                                    content: remainingPrefix,
                                    offset: token.offset + prefixOffset + signaturePrefix.typeName.length
                                });
                        } else
                            result.push({
                                ...token,
                                content: signaturePrefix.content,
                                offset: token.offset + prefixOffset
                            });

                        if (prefixEnd < token.content.length)
                            result.push({
                                ...token,
                                content: token.content.slice(prefixEnd),
                                offset: token.offset + prefixEnd
                            });

                        return result;
                    }

                    if (!links?.has(`${lineIndex + 1}:${tokenColumn}`) || !token.content.endsWith("."))
                        return token;

                    return [{
                        ...token,
                        content: token.content.slice(0, -".".length)
                    },
                    {
                        ...token,
                        content: ".",
                        offset: token.offset + token.content.length - 1
                    }];
                });
            });
        },

        span(node, line, column, lineElement, token) {
            if (!enabled.has(this.meta))
                return;

            const signaturePrefix = signaturePrefixes.get(this.meta)?.get(line)
                ?.find((prefix) => (
                    prefix.column === column &&
                    prefix.typeName === token.content &&
                    prefix.href != null
                ));

            if (signaturePrefix != null) {
                node.tagName = "a";
                node.properties.href = resolveHref(signaturePrefix.href!);
                node.properties["class"] = "nlc-api-link" + (
                    node.properties["class"]
                        ? (" " + node.properties["class"])
                        : ""
                );
                return;
            }

            const original = originalCode.get(this.meta);
            if (original != null && token.content === "abstract" && restoreOptionalModifier(original, line, column, node))
                return;

            const qualifiedLinks = qualifiedSymbolLinks.get(this.meta);
            let href = qualifiedLinks?.get(`${line}:${column}`);

            const isType = token.explanation?.some((explanation) => (
                explanation.scopes.some(({scopeName}) => (
                    scopeName.startsWith("entity.name.type.") ||
                    scopeName === "entity.name.type.ts" ||
                    scopeName === "entity.other.inherited-class.ts"
                ))
            )) ?? false;

            if (href == null && (isType || qualifiedLinks != null))
                href = apiSymbolLinks.get(token.content)?.link;
            if (href == null)
                return;

            const isTypeDeclaration = token.explanation?.some((explanation) => (
                explanation.scopes.some(({scopeName}) => (
                    scopeName === "entity.name.type.alias.ts" ||
                    scopeName === "entity.name.type.class.ts" ||
                    scopeName === "entity.name.type.interface.ts" ||
                    scopeName === "entity.name.type.enum.ts"
                ))
            )) ?? false;

            if (qualifiedLinks == null && isTypeDeclaration)
                return;

            if (href.toLowerCase().endsWith(".md"))
                href = href.slice(0, -".md".length);

            node.tagName = "a";
            node.properties.href = resolveHref(href);
            node.properties["class"] = "nlc-api-link" + (
                node.properties["class"]
                    ? (" " + node.properties["class"])
                    : ""
            );
        }
    };
}

function looksLikeTypeDocMember(code: string): boolean {
    const trimmed = code.trim();

    const modifiers = `(?:(?:${typeDocMemberModifiersRegex})[\\t ]+)*`;
    const identifier = "[A-Za-z_$][\\w$]*";

    return (
        new RegExp(`^${modifiers}(?:get|set)[\\t ]+${identifier}[\\t ]*\\(`).test(trimmed) ||
        new RegExp(`^${modifiers}${identifier}(?:<[^>]+>)?[\\t ]*\\(`).test(trimmed) ||
        new RegExp(`^${modifiers}${identifier}\\??[\\t ]*:`).test(trimmed)
    );
}

function normalizeTypeDocSignature(code: string) {
    const lines = code.split("\n");
    const prefixes = new Map<number, {
        column: number,
        content: string,
        typeName?: string,
        href?: string
    }[]>();

    let changed = false;

    for (const [lineIndex, line] of lines.entries()) {
        const qualifiedMatch = /^([\t ]*)([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)(?=\s*(?:<[^>\n]*>)?\s*\()/.exec(line);
        if (qualifiedMatch != null) {
            const indentation = qualifiedMatch[1] ?? "";
            const typeName = qualifiedMatch[2];

            if (typeName != null) {
                let href = apiSymbolLinks.get(typeName)?.link;

                if (href != null) {
                    if (href.toLowerCase().endsWith(".md"))
                        href = href.slice(0, -".md".length);

                    const prefix = `${typeName}.`;
                    const column = indentation.length;

                    prefixes.set(lineIndex + 1, [{
                        column,
                        content: prefix,
                        typeName,
                        href
                    }]);

                    lines[lineIndex] = indentation + " ".repeat(prefix.length) + line.slice(column + prefix.length);

                    changed = true;
                    continue;
                }
            }
        }

        const constructorMatch = /^([\t ]*)new([\t ]+)([A-Za-z_$][\w$]*)(?=\s*(?:<[^>\n]*>)?\s*\()/.exec(line);
        if (constructorMatch != null) {
            const indentation = constructorMatch[1] ?? "";
            const spacing = constructorMatch[2] ?? " ";
            const typeName = constructorMatch[3];

            if (typeName != null) {
                let href = apiSymbolLinks.get(typeName)?.link;

                if (href != null) {
                    if (href.toLowerCase().endsWith(".md"))
                        href = href.slice(0, -".md".length);

                    const column = indentation.length + "new".length + spacing.length;

                    prefixes.set(lineIndex + 1, [{
                        column,
                        content: typeName,
                        typeName,
                        href
                    }]);

                    lines[lineIndex] = line.slice(0, column) + " ".repeat(typeName.length) + line.slice(column + typeName.length);
                    changed = true;
                }
            }
        }
    }

    if (!changed)
        return undefined;

    return {
        code: lines.join("\n"),
        prefixes
    };
}

function restoreOptionalModifier(original: string, line: number, column: number, node: Element) {
    const originalLine = original.split("\n")[line - 1];
    if (originalLine == null)
        return false;

    if (originalLine.slice(column, column + "optional".length) !== "optional")
        return false;

    node.children = [{
        type: "text",
        value: "optional"
    }];
    return true;
}

function getQualifiedSymbolLinks(code: string) {
    const links = new Map<string, string>();

    for (const [lineIndex, line] of code.split("\n").entries()) {
        for (const match of line.matchAll(/\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\b/g)) {
            const typeName = match[1];
            const memberName = match[2];

            if (typeName == null || memberName == null)
                continue;

            let href = apiSymbolLinks.get(typeName)?.link;
            if (href == null || match.index == null)
                continue;

            if (href.toLowerCase().endsWith(".md"))
                href = href.slice(0, -".md".length);

            links.set(`${lineIndex + 1}:${match.index}`, href);
            links.set(`${lineIndex + 1}:${match.index + typeName.length + 1}`, `${href}#${memberName.toLowerCase()}`);
        }

        for (const match of line.matchAll(/\bnew\s+([A-Za-z_$][\w$]*)\b/g)) {
            const typeName = match[1];

            if (typeName == null || match.index == null)
                continue;

            let href = apiSymbolLinks.get(typeName)?.link;
            if (href == null)
                continue;

            if (href.toLowerCase().endsWith(".md"))
                href = href.slice(0, -".md".length);

            const typeIndex = match.index + match[0].lastIndexOf(typeName);

            links.set(`${lineIndex + 1}:${typeIndex}`, href);
        }
    }

    return links;
}

function typedocSidebarToSymbolMap() {
    const map = new Map<string, {
        link: string,
        section: string
    }>();

    for (const category of typedocSidebar) {
        for (const child of category.items) {
            map.set(child.text, {
                link: child.link,
                section: category.text
            });
        }
    }

    return map;
}

function isTypeToken(token: {
    explanation?: {
        scopes: {
            scopeName: string
        }[]
    }[]
}) {
    return token.explanation?.some((explanation) => (
        explanation.scopes.some(({scopeName}) => (
            scopeName.startsWith("entity.name.type.") ||
            scopeName === "entity.name.type.ts" ||
            scopeName === "entity.other.inherited-class.ts"
        ))
    )) ?? false;
}
