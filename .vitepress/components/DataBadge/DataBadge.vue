<script setup lang="ts">
import {withBase} from "vitepress";

const props = defineProps<{
    title: string,
    content?: string,
    href?: string
}>();
</script>

<template>
    <div class="dataBadge">
        <div class="title">{{props.title}}</div>
        <div v-if="!props.href" class="content">
            <template v-if="props.content">{{props.content}}</template>
            <slot v-else/>
        </div>
        <a v-else class="content" :href="withBase(props.href)" target="_blank">
            <template v-if="props.content">{{props.content}}</template>
            <slot v-else/>
        </a>
    </div>
</template>

<style scoped>
.dataBadge {
    display: inline-flex;
    flex-shrink: 0;
    flex-direction: row;
    background-color: var(--vp-code-bg);
    padding: 1px 8px;
    margin: 4px 0 2px 0;
    margin-inline-end: 6px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 24px;
    gap: 10px;

    > .title {
        flex-shrink: 0;
        font-weight: bold;
    }

    > .content {
        flex-shrink: 0;
        text-decoration: none;
    }
}
</style>
