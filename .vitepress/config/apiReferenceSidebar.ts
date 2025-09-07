import {DefaultTheme} from "vitepress";
/* eslint import/no-unresolved: "off" */
import typedocSidebar from "../../docs/api/typedoc-sidebar.json";

const categoryOrder = [
    "Functions",
    "Classes",
    "Types",
    "Enums"
] as const;

const functionsOrder = [
    "getLlama",
    "resolveModelFile",
    "defineChatSessionFunction",
    "createModelDownloader",
    "resolveChatWrapper",
    "tokenizeText",
    "readGgufFileInfo"
] as const;

const classesOrder = [
    "Llama",
    "LlamaModel",
    "LlamaContext",
    "LlamaContextSequence",
    "LlamaChatSession",
    "LlamaCompletion",
    "LlamaEmbeddingContext",
    "LlamaEmbedding",
    "LlamaRankingContext",
    "LlamaGrammar",
    "LlamaJsonSchemaGrammar",
    "LlamaText",
    "TokenBias",
    "GgufInsights",
    "LlamaChat",
    "TokenMeter",
    "TokenAttributes",
    "ModelDownloader"
] as const;

const chatWrappersOrder = [
    "GeneralChatWrapper",
    "TemplateChatWrapper",
    "JinjaTemplateChatWrapper",
    "QwenChatWrapper",
    "HarmonyChatWrapper",
    "SeedChatWrapper",
    "DeepSeekChatWrapper",
    "Llama3_1ChatWrapper",
    "Llama3_2LightweightChatWrapper",
    "Llama3ChatWrapper",
    "Llama2ChatWrapper",
    "MistralChatWrapper",
    "GemmaChatWrapper",
    "ChatMLChatWrapper",
    "FalconChatWrapper",
    "AlpacaChatWrapper",
    "FunctionaryChatWrapper"
] as const;

const typesOrder = [
    "Token",
    "Tokenizer",
    "Detokenizer"
] as const;

export function getApiReferenceSidebar() {
    return orderApiReferenceSidebar(getSidebar());
}

function getSidebar() {
    return structuredClone(typedocSidebar)
        .map((item) => {
            switch (item.text) {
                case "README":
                case "API":
                    return null;

                case "Classes":
                case "Type Aliases":
                case "Functions":
                    if (item.text === "Type Aliases")
                        item.text = "Types";

                    if (item.collapsed)
                        item.collapsed = false;

                    if (item.text === "Types")
                        item.collapsed = true;

                    if (item.items instanceof Array)
                        item.items = item.items.map((subItem) => {
                            if ((subItem as {collapsed?: boolean}).collapsed)
                                // @ts-ignore
                                delete subItem.collapsed;

                            return subItem;
                        });

                    return item;

                case "Enumerations":
                    item.text = "Enums";

                    if (item.collapsed)
                        item.collapsed = false;
                    return item;

                case "Variables":
                    if (item.collapsed)
                        item.collapsed = false;

                    return item;
            }

            return item;
        })
        .filter((item) => item != null) as typeof typedocSidebar;
}

function orderApiReferenceSidebar(sidebar: typeof typedocSidebar): typeof typedocSidebar {
    applyOverrides(sidebar);
    orderClasses(sidebar);
    orderTypes(sidebar);
    orderFunctions(sidebar);

    sortItemsInOrder(sidebar, categoryOrder);

    return sidebar;
}

function applyOverrides(sidebar: typeof typedocSidebar) {
    const functions = sidebar.find((item) => item.text === "Functions");

    const llamaTextFunction = functions?.items?.find((item) => item.text === "LlamaText");
    if (llamaTextFunction != null) {
        delete (llamaTextFunction as {link?: string}).link;
    }

    const classes = sidebar.find((item) => item.text === "Classes");
    if (classes != null && classes.items instanceof Array && !classes.items.some((item) => item.text === "LlamaText")) {
        classes.items.push({
            text: "LlamaText",
            link: "/api/classes/LlamaText.md"
        });
    }
}

function orderClasses(sidebar: typeof typedocSidebar) {
    const baseChatWrapper = "ChatWrapper";

    const classes = sidebar.find((item) => item.text === "Classes");

    if (classes == null || !(classes.items instanceof Array))
        return;

    groupItems(
        classes.items,
        (item) => item.text === "LlamaModelTokens",
        (item) => item.text != null && ["LlamaModelInfillTokens"].includes(item.text),
        {moveToEndIfGrouped: false}
    );
    groupItems(
        classes.items,
        (item) => item.text === "LlamaModel",
        (item) => item.text != null && ["LlamaModelTokens"].includes(item.text),
        {moveToEndIfGrouped: false}
    );

    groupItems(
        classes.items,
        (item) => item.text === "LlamaChatSession",
        (item) => item.text != null && ["LlamaChatSessionPromptCompletionEngine"].includes(item.text),
        {moveToEndIfGrouped: false}
    );

    groupItems(
        classes.items,
        (item) => item.text === "GgufInsights",
        (item) => item.text != null && ["GgufInsightsConfigurationResolver"].includes(item.text),
        {moveToEndIfGrouped: false}
    );

    moveItem(
        classes.items,
        (item) => item.text === "Llama",
        0
    );
    moveItem(
        classes.items,
        (item) => item.text === "LlamaModel",
        0
    );

    {
        const LlamaTextGroupItemsOrder = ["SpecialTokensText", "SpecialToken"];

        const LlamaTextGroup = ensureParentAndGroupItems(
            classes.items,
            "LlamaText",
            (item) => item.text != null && LlamaTextGroupItemsOrder.includes(item.text),
            {moveToEndIfGrouped: true, collapsed: true}
        );
        sortItemsInOrder(LlamaTextGroup?.items, LlamaTextGroupItemsOrder);
    }

    {
        const chatWrappersGroup = ensureParentAndGroupItems(
            classes.items,
            "Chat wrappers",
            (item) => item.text !== baseChatWrapper && item.text?.endsWith(baseChatWrapper),
            {moveToEndIfGrouped: false, collapsed: false}
        );
        sortItemsInOrder(chatWrappersGroup?.items, chatWrappersOrder);

        moveItem(
            classes.items,
            (item) => item.text === baseChatWrapper,
            "end"
        );
        moveItem(
            classes.items,
            (item) => item === chatWrappersGroup,
            "end"
        );
    }

    ensureParentAndGroupItems(
        classes.items,
        "Errors",
        (item) => item.text != null && /[a-z0-9]Error$/.test(item.text),
        {moveToEndIfGrouped: false}
    );
    moveItem(
        classes.items,
        (item) => item.text === "Errors",
        "end"
    );

    sortItemsInOrder(classes.items, classesOrder);
}

function orderTypes(sidebar: typeof typedocSidebar) {
    const types = sidebar.find((item) => item.text === "Types");

    if (types == null || !(types.items instanceof Array))
        return;

    groupItems(
        types.items,
        (item) => item.text === "BatchingOptions",
        (item) => (
            item.text === "BatchItem" ||
            item.text === "CustomBatchingDispatchSchedule" ||
            item.text === "CustomBatchingPrioritizationStrategy" ||
            item.text === "PrioritizedBatchItem"
        ),
        {collapsed: true}
    );
    groupItems(
        types.items,
        (item) => item.text === "LlamaContextOptions",
        (item) => item.text === "BatchingOptions"
    );
    groupItems(
        types.items,
        (item) => item.text === "GbnfJsonSchema",
        (item) => item.text?.startsWith("GbnfJson")
    );

    groupItems(
        types.items,
        (item) => item.text === "LlamaChatSessionOptions",
        (item) => item.text != null && ["LlamaChatSessionContextShiftOptions", "ChatSessionModelFunction"].includes(item.text)
    );

    groupItems(
        types.items,
        (item) => item.text === "LLamaChatPromptOptions",
        (item) => item.text != null && ["LlamaChatSessionRepeatPenalty", "ChatSessionModelFunctions", "ChatModelFunctions"].includes(item.text)
    );

    groupItems(
        types.items,
        (item) => item.text === "ChatModelResponse",
        (item) => item.text === "ChatModelFunctionCall"
    );
    groupItems(
        types.items,
        (item) => item.text === "ChatHistoryItem",
        (item) => item.text != null && ["ChatSystemMessage", "ChatUserMessage", "ChatModelResponse"].includes(item.text)
    );

    groupItems(
        types.items,
        (item) => item.text === "LlamaChatResponse",
        (item) => item.text === "LlamaChatResponseFunctionCall"
    );

    ensureParentAndGroupItems(
        types.items,
        "LlamaText",
        (item) => item.text?.startsWith("LlamaText") || item.text === "BuiltinSpecialTokenValue"
    );

    {
        groupItems(
            types.items,
            (item) => item.text === "GgufMetadata",
            (item) => item.text != null && item.text.startsWith("GgufMetadata")
        );
        groupItems(
            types.items,
            (item) => item.text === "GgufFileInfo",
            (item) => item.text != null && (
                item.text.startsWith("GgufMetadata") || item.text === "GgufTensorInfo"
            )
        );
    }

    {
        groupItems(
            types.items,
            (item) => item.text === "JinjaTemplateChatWrapperOptions",
            (item) => item.text != null && (
                ["JinjaTemplateChatWrapperOptionsConvertMessageFormat"].includes(item.text)
            )
        );

        ensureParentAndGroupItems(
            types.items,
            "Chat Wrapper Options",
            (item) => item.text != null && (
                /[a-z0-9]ChatWrapperOptions$/.test(item.text) || ["ChatHistoryFunctionCallMessageTemplate"].includes(item.text)
            ),
            {moveToEndIfGrouped: true}
        );
        ensureParentAndGroupItems(
            types.items,
            "Options",
            (item) => item.text != null && (
                item.text === "Chat Wrapper Options" || /[a-z0-9]Options$/.test(item.text)
            ),
            {moveToEndIfGrouped: true}
        );
    }

    moveCollapseItemsToTheEnd(types.items);

    sortItemsInOrder(types.items, typesOrder);
}

function orderFunctions(sidebar: typeof typedocSidebar) {
    const functions = sidebar.find((item) => item.text === "Functions");

    if (functions == null || !(functions.items instanceof Array))
        return;

    ensureParentAndGroupItems(
        functions.items,
        "Log levels",
        (item) => item.text != null && item.text.startsWith("LlamaLogLevel")
    );
    ensureParentAndGroupItems(
        functions.items,
        "Type guards",
        (item) => item.text != null && /^is[A-Z]/.test(item.text)
    );

    sortItemsInOrder(functions.items, functionsOrder);

    moveCollapseItemsToTheEnd(functions.items);
}


function groupItems(
    items: DefaultTheme.SidebarItem[] | undefined,
    findParent: (item: DefaultTheme.SidebarItem) => boolean | undefined,
    findChildren: (item: DefaultTheme.SidebarItem) => boolean | undefined,
    {collapsed = true, moveToEndIfGrouped = true}: {collapsed?: boolean, moveToEndIfGrouped?: boolean} = {}
) {
    const children: DefaultTheme.SidebarItem[] = [];

    if (items == null || !(items instanceof Array))
        return;

    const parent = items.find(findParent) as DefaultTheme.SidebarItem | null;

    if (parent == null)
        return;

    for (const item of items.slice()) {
        if (item === parent || !findChildren(item))
            continue;

        items.splice(items.indexOf(item), 1);
        children.push(item);
    }

    if (children.length > 0) {
        parent.collapsed = collapsed;
        if (parent.items == null)
            parent.items = children;
        else {
            for (const child of children)
                parent.items.push(child);
        }

        if (moveToEndIfGrouped) {
            items.splice(items.indexOf(parent as typeof items[number]), 1);
            items.push(parent as typeof items[number]);
        }
    }
}

function ensureParentAndGroupItems(
    items: DefaultTheme.SidebarItem[] | undefined,
    parentText: string,
    findChildren: (item: DefaultTheme.SidebarItem) => boolean | undefined,
    {collapsed = true, moveToEndIfGrouped = true}: {collapsed?: boolean, moveToEndIfGrouped?: boolean} = {}
) {
    if (items == null || !(items instanceof Array))
        return;

    let parent = items.find((item) => item.text === parentText) as DefaultTheme.SidebarItem;
    let addedParent = false;

    if (parent == null) {
        parent = {
            text: parentText,
            collapsed: true,
            items: []
        };
        items.push(parent);
        addedParent = true;
    }

    groupItems(
        items,
        (item) => item === parent,
        findChildren,
        {collapsed, moveToEndIfGrouped}
    );

    if (addedParent && parent.items?.length === 0) {
        items.splice(items.indexOf(parent), 1);
        return null;
    }

    return parent;
}

function moveItem(
    items: DefaultTheme.SidebarItem[] | undefined,
    findItem: (item: DefaultTheme.SidebarItem) => boolean | undefined,
    newIndex: number | "end"
) {
    if (items == null || !(items instanceof Array))
        return;

    const item = items.find(findItem);
    if (item != null) {
        items.splice(items.indexOf(item), 1);

        if (newIndex === "end")
            items.push(item);
        else
            items.splice(newIndex, 0, item);
    }
}

function moveCollapseItemsToTheEnd(items: DefaultTheme.SidebarItem[] | undefined) {
    if (items == null || !(items instanceof Array))
        return;

    items.sort((a, b) => {
        if (a.collapsed && !b.collapsed)
            return 1;
        if (!a.collapsed && b.collapsed)
            return -1;

        return 0;
    });
}

function sortItemsInOrder(items: DefaultTheme.SidebarItem[] | undefined, order: readonly string[]) {
    if (items == null || !(items instanceof Array))
        return;

    items.sort((a, b) => {
        const aIndex = order.indexOf(a.text as typeof order[number]);
        const bIndex = order.indexOf(b.text as typeof order[number]);

        if (aIndex < 0 && bIndex < 0)
            return 0;
        if (aIndex < 0)
            return 1;
        if (bIndex < 0)
            return -1;

        return aIndex - bIndex;
    });
}
