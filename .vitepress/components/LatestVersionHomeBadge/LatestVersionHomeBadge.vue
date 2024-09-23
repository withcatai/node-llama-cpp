<script setup lang="ts">
import {useData, withBase} from "vitepress";

const props = defineProps<{
    text: string | ((contentProps: any) => string),
    link: string,
    hideDate?: Date,
    type: "mobile" | "desktop"
}>();

const hide = props.hideDate != null
    ? Date.now() > props.hideDate.getTime()
    : false;

const data = useData();

const text = props.text instanceof Function
    ? props.text(data.site.value.contentProps)
    : props.text;

const resolvedLink = props.link != null
    ? withBase(props.link)
    : null;
</script>

<template>
    <a
        v-if="!hide"
        :class="{
            latestVersionBadge: true,
            forMobile: props.type === 'mobile',
            forDesktop: props.type === 'desktop'
        }"
        :href="resolvedLink"
    >
        <span class="text" v-html="text"></span>
        <span v-if="resolvedLink != null" class="vpi-arrow-right"></span>
    </a>
</template>

<style scoped>
.latestVersionBadge {
    display: none;
    flex-direction: row;
    align-items: center;
    border: solid 1px color-mix(in srgb, var(--vp-button-alt-bg) 24%, transparent);
    background-color: color-mix(in srgb, var(--vp-button-alt-bg) 52%, transparent);
    color: var(--vp-button-alt-text);
    padding: 0 12px;
    line-height: 28px;
    font-size: 14px;
    border-radius: 12px;
    text-align: start;
    white-space: pre-wrap;

    transition: color 0.25s, border-color 0.25s, background-color 0.25s;

    &.forDesktop {
        @media (width >= 960px) {
            display: inline-flex;
            position: absolute;
            margin-top: -30px;
        }
    }
    &.forMobile {
        @media (width < 960px) {
            display: inline-flex;
            margin-top: 24px;
        }
    }

    &:hover {
        border-color: color-mix(in srgb, var(--vp-button-alt-bg) 100%, transparent);
        color: var(--vp-button-alt-hover-text);
        background-color: color-mix(in srgb, var(--vp-button-alt-bg) 100%, transparent);

    }

    > .vpi-arrow-right {
        margin-left: 6px;
    }
}

.dark .latestVersionBadge:hover {
    border-color: color-mix(in srgb, var(--vp-button-alt-bg) 72%, transparent);
    color: var(--vp-button-alt-hover-text);
    background-color: color-mix(in srgb, var(--vp-button-alt-bg) 72%, transparent);
}

:global(html.start-animation) {
    @media (width >= 960px) {
        .latestVersionBadge.forDesktop {
            transition: color 0.25s, border-color 0.25s, background-color 0.25s, opacity 1s, transform 1s, display 1s ease-in-out;
            transition-behavior: allow-discrete;
            transform: translateY(0px);
            opacity: 1;

            @starting-style {
                transform: translateY(-8px);
                opacity: 0;
            }
        }
    }
}
</style>
