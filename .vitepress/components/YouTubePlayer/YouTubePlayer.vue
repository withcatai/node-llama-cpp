<script setup lang="ts">
import {computed} from "vue";
const props = withDefaults(defineProps<{
    id: string,
    autoplay?: boolean,
    controls?: boolean
}>(), {
    autoplay: false,
    controls: true
});

const url = computed(() => {
    const res = new URL(`https://www.youtube.com/embed/${props.id}`);

    if (typeof location !== "undefined")
        res.searchParams.set("origin", location.origin);

    res.searchParams.set("autoplay", props.autoplay ? "1" : "0");
    res.searchParams.set("controls", props.controls ? "1" : "0");
    res.searchParams.set("playsinline", "1");
    res.searchParams.set("rel", "0");

    return res.href;
});
</script>

<template>
    <div class="youtubePlayer" v-if="url">
        <iframe
            class="player"
            :src="url"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
        />
    </div>
</template>

<style scoped>
.youtubePlayer {
    margin-top: 1em;
    overflow: hidden;
    border-radius: 12px;
    background-color: color-mix(in srgb, var(--vp-c-text-1) 6%, transparent);

    > .player {
        width: 100%;
        aspect-ratio: 16 / 9;
        min-height: 240px;
        max-height: 600px;
        border: none;
    }
}
</style>
