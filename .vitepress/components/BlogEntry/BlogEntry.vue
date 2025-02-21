<script setup lang="ts">
import {withBase} from "vitepress";

const props = defineProps<{
    title: string,
    date: Date | string,
    description?: string,
    link: string,
    image?: {
        url?: string,
        lowResUrl?: string,
        width?: number,
        height?: number,
        alt?: string
    }
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
            <a class="image" :href="withBase(props.link)">
                <img
                    class="image"
                    v-if="props.image?.url != null"
                    :src="props.image.url"
                    :width="props.image.width"
                    :height="props.image.height"
                    :alt="props.image.alt"
                    :style="{
                        'background-image': props.image.lowResUrl
                            ? `url(${JSON.stringify(props.image.lowResUrl)})`
                            : undefined,
                        '--aspect-ratio': (props.image.width && props.image.height)
                            ? (props.image.width / props.image.height)
                            : undefined
                    }"
                />
            </a>
            <div class="description" v-html="props.description"></div>
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
        position: relative;

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

        > .image {
            > .image {
                display: block;
                font-style: italic;
                border-radius: 24px;
                box-shadow: 0px 8px 32px 0px rgb(0 0 0 / 32%);
                background-color: var(--vp-c-bg-soft);
                margin-bottom: 24px;
                object-fit: contain;
                object-position: left;
                width: 100%;
                max-width: calc(var(--aspect-ratio) * var(--max-height));
                align-self: start;
                background-repeat: no-repeat;
                background-size: cover;
                --max-height: 320px;
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
