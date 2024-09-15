<script setup lang="ts">
import {onBeforeMount, onUnmounted, ref, watch} from "vue";
import {useRoute, useData, withBase} from "vitepress";

const route = useRoute();
const {frontmatter, title, isDark} = useData();

const commentsEnabled = ref(false);
const reactionsEnabled = ref(false);
const isBlog = ref(false);
const needToResendTheme = ref(true);
const commentsRenderKey = ref("");

function sendMessageToGiscus(message: object) {
    if (typeof document === "undefined")
        return;

    const iframe = document.querySelector("iframe.giscus-frame") as HTMLIFrameElement | undefined;

    if (iframe != null)
        iframe?.contentWindow?.postMessage({giscus: message}, "https://giscus.app");
}

function setGiscusTheme(theme: string) {
    sendMessageToGiscus({
        setConfig: {
            theme
        }
    });
}

function getCommentsRenderKey() {
    return `${commentsEnabled.value}-${reactionsEnabled.value}-${route.path}`;
}

function getTheme(dark: boolean) {
    if (typeof location === "undefined" || typeof document === "undefined")
        return dark
            ? "dark"
            : "light";

    return dark
        ? new URL(withBase("/giscus/dark.css"), location.origin).href
        : new URL(withBase("/giscus/light.css"), location.origin).href;
}

function updateState() {
    isBlog.value = route?.path !== "/blog/" && route?.path?.startsWith("/blog/") || false;
    commentsEnabled.value = frontmatter.value.comments !== false && (
        route?.path === "/guide" ||
        route?.path?.startsWith("/guide/") ||
        isBlog.value
    ) || false;
    reactionsEnabled.value = frontmatter.value.comments?.reactions !== false && (
        route?.path === "/blog" ||
        route?.path?.startsWith("/blog/")
    ) || false;
    commentsRenderKey.value = getCommentsRenderKey();
}

function onGiscusMessage(message: any) {
    if (needToResendTheme.value) {
        needToResendTheme.value = false;
        setGiscusTheme(getTheme(isDark.value));
    }
}

function handleWindowMessage(event: MessageEvent) {
    if (event.origin !== "https://giscus.app")
        return;

    if (typeof event.data !== "object" || event.data.giscus == null)
        return;

    onGiscusMessage(event.data.giscus);
}

watch(() => route.path, () => {
    updateState();
    needToResendTheme.value = true;
});
watch(() => isDark.value, () => {
    setGiscusTheme(getTheme(isDark.value));
});

onBeforeMount(() => {
    if (typeof window === "undefined")
        return;

    window.addEventListener("message", handleWindowMessage);
    updateState();
});

onUnmounted(() => {
    if (typeof window === "undefined")
        return;

    window.removeEventListener("message", handleWindowMessage);
});
</script>

<template>
    <div :key="commentsRenderKey" v-if="commentsEnabled" :class="{
        giscus: true,
        isBlog: isBlog
    }">
        <component
            :is="'script'"
            src="https://giscus.app/client.js"
            data-repo="withcatai/node-llama-cpp"
            data-repo-id="R_kgDOKGciFw"
            data-category="Documentation comments"
            data-category-id="DIC_kwDOKGciF84CiKJc"
            data-mapping="pathname"
            data-strict="1"
            :data-reactions-enabled="reactionsEnabled ? '1' : '0'"
            data-emit-metadata="0"
            data-input-position="bottom"
            :data-theme="getTheme(isDark)"
            data-lang="en"
            data-loading="lazy"
            crossorigin="anonymous"
            async
        />
    </div>
</template>

<style scoped>
.giscus {
    color-scheme: light;
    position: relative;
    border: none;
    border-top: 1px solid transparent;

    &:has(iframe) {
        border-top-color: var(--vp-c-divider);
        margin-top: 24px;

        &.isBlog {
            margin-top: 64px;
        }
    }

    &:not(:has(iframe)):before,
    &:has(iframe.giscus-frame.giscus-frame--loading):before {
        content: "Loading comments...";
        display: block;
        width: 100%;
        text-align: center;
        padding: 48px 24px;
        color: var(--vp-c-text-1);
        opacity: 0.6;
        user-select: none;
    }

    &:has(iframe.giscus-frame.giscus-frame--loading):before {
        position: absolute;
    }

    &:global(>iframe) {
        margin-top: 24px;
        width: 100%;
    }

    &.isBlog:global(>iframe) {
        margin-top: 24px;
    }
}
</style>
