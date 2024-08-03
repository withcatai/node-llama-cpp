<script setup lang="ts">
import {provide, nextTick} from "vue";
import {useData} from "vitepress";

const {isDark} = useData();

const themeTransitionEnabled = (document as { startViewTransition?: any }).startViewTransition != null;
document.documentElement.classList.toggle("theme-transition", themeTransitionEnabled);

provide("toggle-appearance", async () => {
    if (!themeTransitionEnabled) {
        isDark.value = !isDark.value;
        return;
    }

    const showDark = !isDark.value;
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
        await (document as {
            startViewTransition(callback: () => Promise<void>): {
                ready: Promise<void>
            }
        })
            .startViewTransition(async () => {
                isDark.value = showDark;
                await nextTick();
            }).ready

        document.documentElement.animate({
            clipPath: showDark
                ? ["rect(0px 100% 0px 0px)", "rect(0px 100% 100% 0px)"]
                : ["rect(0px 100% 100% 0px)", "rect(100% 100% 100% 0px)"]
        }, {
            duration: 300,
            easing: "ease-in-out",
            pseudoElement: showDark
                ? "::view-transition-new(root)"
                : "::view-transition-old(root)"
        });
    } else {
        await (document as {
            startViewTransition(callback: () => Promise<void>): {
                ready: Promise<void>
            }
        })
            .startViewTransition(async () => {
                isDark.value = showDark;
                await nextTick();
            }).ready

        document.documentElement.animate({
            opacity: showDark
                ? [0, 1]
                : [1, 0]
        }, {
            duration: 300,
            easing: "ease-in-out",
            pseudoElement: showDark
                ? "::view-transition-new(root)"
                : "::view-transition-old(root)"
        });
    }
})
</script>

<template>
    <slot></slot>
</template>

<style>
::view-transition-image-pair(root) {
    isolation: isolate;
}

::view-transition-old(root),
::view-transition-new(root) {
    animation: none;
    mix-blend-mode: normal;
    display: block;
}

.dark::view-transition-old(root),
::view-transition-new(root) {
    z-index: 1;
}

::view-transition-old(root),
.dark::view-transition-new(root) {
    z-index: 9999;
}

html.theme-transition .VPSwitch.VPSwitchAppearance>.check {
    transition-duration: 0s !important;
}
</style>
