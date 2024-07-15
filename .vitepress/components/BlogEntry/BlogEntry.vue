<script setup lang="ts">
import {withBase} from "vitepress";

const props = defineProps<{
    title: string,
    date: Date | string,
    description?: string,
    link: string
}>();

const dateText = new Date(props.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
});
</script>

<template>
    <div class="blogEntry">
        <p class="date">{{dateText}}</p>
        <div class="content">
            <a class="title" :href="withBase(props.link)">
                <h2>{{ props.title }}</h2>
            </a>
            <p class="description">{{ props.description }}</p>
            <a class="readMore" :href="withBase(props.link)">
                Read more
                <span class="vpi-arrow-right"></span>
            </a>
        </div>
    </div>
</template>

<style scoped>
.blogEntry {
    display: flex;
    flex-direction: column;
    padding: 48px 0px;

    @media (min-width: 960px) {
        flex-direction: row;

        > .date {
            min-width: 256px;
        }
    }

    &:not(:first-of-type) {
        border-top: solid 1px color-mix(in srgb, var(--vp-c-border), transparent 64%);
    }

    > .date {
        color: var(--vp-c-text-1);
        opacity: 0.6;
        font-size: 16px;
        margin: 0 0 4px 0;
    }

    > .content {
        display: flex;
        flex-direction: column;

        > .title {
            color: var(--vp-c-text-1);
            text-decoration: none;
            margin: 0 0 16px 0;

            > h2 {
                font-size: 24px;
                padding: 0;
                margin: 0;
                border-top: none;
            }
        }

        > .description {
            color: var(--vp-c-text-1);
            font-size: 18px;
            margin: 0;
        }

        > .readMore {
            display: flex;
            flex-direction: row;
            align-items: center;
            text-decoration: none;
            margin: 16px 0 0 0;

            > .vpi-arrow-right {
                margin-left: 6px;
            }
        }
    }
}
</style>
