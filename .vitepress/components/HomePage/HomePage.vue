<script setup lang="ts">
import {withBase} from "vitepress";
import {ref} from "vue";
import {
    defaultDownloadElectronExampleAppLink,
    getElectronExampleAppDownloadLink
} from "./utils/getElectronExampleAppDownloadLink.js";

const downloadElectronExampleAppLink = ref<string>(defaultDownloadElectronExampleAppLink);

getElectronExampleAppDownloadLink()
    .then((link) => {
        downloadElectronExampleAppLink.value = link;
    });
</script>

<template>
    <section class="content">
        <div class="container other-color">
            <div class="panels vp-doc">
                <div class="panel">
                    <h2>Chat with many popular models</h2>
                    <p>Experience the ease of running models on your machine</p>
                    <div class="code">
                        <slot name="chat-command" />
                        <blockquote>
                            <p>To chat with models using a UI, try the <a target="_blank" :href="downloadElectronExampleAppLink">example
                                Electron app</a></p>
                        </blockquote>
                    </div>
                </div>
                <div class="panel">
                    <h2>Inspect your hardware</h2>
                    <p>Check out your hardware capabilities</p>
                    <div class="code">
                        <slot name="inspect-command" />
                        <p><a class="learn-more" :href="withBase('/cli/inspect/gpu')">Learn more <span class="vpi-arrow-right"></span></a></p>
                    </div>
                </div>
            </div>
            <div class="features-list vp-doc">
                <h2>A complete package</h2>
                <p>Everything you need to use large language models in your project</p>
                <div class="content">
                    <slot name="features-list" />
                </div>
            </div>
        </div>
        <div class="container">
            <div class="panels vp-doc">
                <div class="panel">
                    <h2>Prompt a model</h2>
                    <p>Integrate <code>node-llama-cpp</code> in your codebase and prompt models</p>
                    <div class="code">
                        <slot name="simple-code" />
                        <p><a class="learn-more" :href="withBase('/guide/#usage')">Learn more <span class="vpi-arrow-right"></span></a></p>
                    </div>
                </div>
                <div class="panel">
                    <h2>Embed documents</h2>
                    <p>Get embedding for a given text</p>
                    <div class="code">
                        <slot name="simple-embedding" />
                        <p><a class="learn-more" :href="withBase('/guide/embedding')">Learn more <span class="vpi-arrow-right"></span></a></p>
                    </div>
                </div>
            </div>
        </div>
        <div class="container">
            <div class="panels vp-doc">
                <div class="panel">
                    <h2>Enforce a JSON schema</h2>
                    <p>Force a model response to follow your JSON schema</p>
                    <div class="code">
                        <slot name="json-schema" />
                        <p><a class="learn-more" :href="withBase('/guide/#chatbot-with-json-schema')">Learn more <span class="vpi-arrow-right"></span></a></p>
                    </div>
                </div>
                <div class="panel">
                    <h2>Prompt with function calling</h2>
                    <p>Let a model call functions to retrieve data or perform actions</p>
                    <div class="code">
                        <slot name="function-calling" />
                        <p><a class="learn-more" :href="withBase('/guide/#chatbot-with-function-calling')">Learn more <span class="vpi-arrow-right"></span></a></p>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.content {
    margin-top: calc(96px * 1.5);
    display: flex;
    flex-direction: column;

    .container {
        position: relative;
        isolation: isolate;

        &.other-color {
            margin-bottom: calc(96px * 1.5 - (24px + 16px));

            &:before {
                content: "";
                position: absolute;
                inset: calc(-128px - 24px) var(--vp-offset, calc(-1 * (100vw - 100%) / 2));
                display: block;
                z-index: -1;
                pointer-events: none;
                --gradient-size: 128px;
                background-image: linear-gradient(to bottom, transparent, var(--vp-c-bg-soft) var(--gradient-size), var(--vp-c-bg-soft) calc(100% - var(--gradient-size)), transparent);
                /* background-image: radial-gradient(200% 50% at 50% 50%, var(--vp-c-bg-soft), var(--vp-c-bg-soft) calc(80% - var(--gradient-size)), transparent); */
            }

            .code {
                :global(.language-shell),
                :global(.language-TypeScript) {
                    background-color: var(--vp-c-bg);
                }
            }
        }
    }
}

.panels {
    display: flex;
    flex-direction: column;
    column-gap: calc(16px + (24px * 2));
    row-gap: 24px;
    padding: 24px 0px;

    --panel-background-color: var(--vp-c-bg-soft);

    @media (min-width: 960px) {
        display: flex;
        flex-direction: row !important;
        flex-wrap: wrap;
    }

    > .panel {
        flex-grow: 1;
        border-radius: 12px;
        flex-basis: 0%;

        > h2 {
            letter-spacing: -0.02em;
            line-height: 40px;
            font-size: 28px;
            margin: 16px 0px;
            padding-top: 0px;
            border-top: none;

            @media (min-width: 768px) {
                font-size: 32px;
            }
        }

        .learn-more {
            display: inline-flex;
            flex-direction: row;
            align-items: center;
            text-decoration: none;
            float: right;
            margin-left: 24px;

            @media (min-width: 640px) {
                margin-right: 24px;
            }

            > .vpi-arrow-right {
                margin-left: 6px;
            }
        }

        .code {
            :global(.language-shell),
            :global(.language-TypeScript) {
                /* margin-inline-start: -24px; */

                :global(.lang) {
                    display: none;
                }
            }

            > blockquote {
                padding-left: 0px;
                border-left: none;
            }
        }
    }
}

.features-list {
    padding: 0px calc((100svw - 100%) / 2);
    margin: 32px calc(-1*(100svw - 100%) / 2) 0px calc(-1*(100svw - 100%) / 2);
    overflow: hidden;

    > h2 {
        letter-spacing: -0.02em;
        line-height: 40px;
        font-size: 28px;
        margin: 16px 0px;
        padding-top: 0px;
        border-top: none;

        @media (min-width: 768px) {
            font-size: 32px;
        }
    }

    > .content {
        overflow: hidden;
        --mask-size: 148px;
        --fade-size: 64px;
        --fade-offset: 48px;
        margin: 0px calc(-1 * var(--mask-size, 0px));
        padding: 0px var(--mask-size, 0px);
        margin-top: 24px;

        @media (min-width: 1280px) {
            --fade-size: 96px;
            --fade-offset: 48px;
        }

        &:deep(>ul) {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            padding: 0px;
            margin: 0px calc(-1 * var(--mask-size, 0px));
            justify-content: center;
            gap: 12px;
            mask: linear-gradient(to right, transparent calc(var(--mask-size) - var(--fade-offset)), black calc(var(--mask-size) + var(--fade-size)), black calc(100% - var(--mask-size) - var(--fade-size)), transparent calc(100% - var(--mask-size) + var(--fade-offset)));
            margin-bottom: calc(-1lh - (12px * 2) - 6px); /* line height + top padding + bottom padding + half row gap */

            &:global(>li) {
                display: block;
                padding: 12px 16px;
                border-radius: 12px;
                background-color: var(--vp-c-bg);
                margin: 0px;
                white-space: pre;

                &:global(>a) {
                    margin: -13px -17px;
                    padding: 12px 16px;
                    border-radius: 12px;
                    text-decoration: none;
                    color: inherit;
                    font-weight: inherit;
                    border: solid 1px transparent;
                    transition: border-color 0.25s;

                    &:hover {
                        border-color: var(--vp-c-brand-1);
                    }
                }
            }
        }
    }
}

:global(.VPHome .VPHero .container .main) {
    &:global(>.name) {
        font-weight: 701;
    }

    &:global(>.text) {
        font-weight: 699;
    }
}

:global(html.start-animation) {
    .content {
        transition: opacity 0.5s 0.25s, transform 0.5s 0.25s, translate 0.5s, display 1s ease-in-out;
        transition-behavior: allow-discrete;
        translate: 0px 0px;
        transform: translateY(0px);
        opacity: 1;

        @starting-style {
            translate: 0px 8px;
            transform: translateY(8px);
            opacity: 0;
        }
    }

    :global(#app>.Layout) {
        transition: background-color 0.5s, transform 0.5s ease-in-out, opacity 0.5s ease-in-out, display 1s ease-in-out;
        transition-behavior: allow-discrete;
        /* transform: translateY(0px); */
        opacity: 1;

        @starting-style {
            transform: translateY(-8px);
            opacity: 0;
        }
    }

    :global(.VPHome img.VPImage) {
        transition: scale 0.5s ease-in-out, display 1s ease-in-out;
        transition-behavior: allow-discrete;
        transform-origin: 0% 0%;
        scale: 1;

        @starting-style {
            scale: 1.01;
        }
    }

    :global(.VPHome .VPHero .container .main) {
        &:global(>.name) {
            transition: font-weight 0.5s ease-in-out;

            @starting-style {
                text-rendering: optimizeSpeed;
                font-weight: 725;
            }
        }

        &:global(>.text) {
            transition: font-weight 0.5s ease-in-out;

            @starting-style {
                text-rendering: optimizeSpeed;
                font-weight: 675;
            }
        }

        &:global(>.tagline) {
            transition: transform 0.5s ease-in-out;

            @starting-style {
                transform: translateY(2px);
            }
        }
    }
}
</style>
