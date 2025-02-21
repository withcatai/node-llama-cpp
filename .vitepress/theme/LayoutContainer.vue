<script setup lang="ts">
import {provide, nextTick, onBeforeMount, watch} from "vue";
import {useData, useRoute} from "vitepress";

const {isDark} = useData();
const route = useRoute();

const appShowAnimationName = "app-show";
const appShowAnimationDelay = 300;

const themeTransitionEnabled = typeof document === "undefined"
    ? false
    : (document as { startViewTransition?: any })?.startViewTransition != null;

if (typeof document !== "undefined")
    document?.documentElement.classList.toggle("theme-transition", themeTransitionEnabled);

function updateIsBlogPage() {
    const blogIndex = route.path === "/blog/";
    document?.documentElement.classList.toggle("blog-page", !blogIndex && route.path.startsWith("/blog/"));
    document?.documentElement.classList.toggle("blog-index", blogIndex);
}

watch(() => route.path, updateIsBlogPage);

onBeforeMount(() => {
    if (typeof document === "undefined")
        return;

    updateIsBlogPage();
    document.documentElement.classList.add("start-animation");

    // ensure homepage starting style animations are played on production builds
    if (route.path === "/") {
        document.querySelector("#app")?.animate({
            display: ["none", "initial"]
        }, {
            duration: 1,
            easing: "linear"
        });

        const appShowAnimation = (document.querySelector("#app").getAnimations?.() ?? [])
            .find(animation => animation instanceof CSSAnimation && animation.animationName === appShowAnimationName);

        appShowAnimation?.cancel();
    } else {
        const appShowAnimation = (document.querySelector("#app").getAnimations?.() ?? [])
            .find(animation => animation instanceof CSSAnimation && animation.animationName === appShowAnimationName);

        if (appShowAnimation != null && appShowAnimation.currentTime < appShowAnimationDelay)
            appShowAnimation.currentTime = appShowAnimationDelay;
    }

    setTimeout(() => {
        document.documentElement.classList.remove("start-animation");
    }, 1000 * 2);
});

provide("toggle-appearance", async () => {
    if (!themeTransitionEnabled || typeof document === "undefined") {
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
            // clipPath: showDark
            //     ? ["rect(0px 100% 0px 0px)", "rect(0px 100% 100% 0px)"]
            //     : ["rect(0px 100% 100% 0px)", "rect(100% 100% 100% 0px)"],
            maskPosition: showDark
                ? ["0% 150%", "0% 75%"]
                : ["0% 25%", "0% -52%"]
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
    mask: linear-gradient(to bottom, rgb(0 0 0 / 0%) 0%, black calc((50 / 300) * 100%), black calc((1 - (50 / 300)) * 100%), rgb(0 0 0 / 0%) 100%) content-box 0 75% / 100% 300% no-repeat;
    z-index: 9999;
}

html.theme-transition .VPSwitch.VPSwitchAppearance>.check {
    transition-duration: 0s !important;
}
</style>
