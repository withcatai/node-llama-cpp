---
title: Blog
description: node-llama-cpp blog
editLink: false
lastUpdated: false
outline: false
aside: false
---
<style>
@media (min-width: 960px) {
    .VPDoc:not(.has-sidebar)>.container>.content {
        max-width: 992px;
    }
}
</style>

<script setup lang="ts">
import BlogEntry from "../../.vitepress/components/BlogEntry/BlogEntry.vue";
import {data} from "./blog.data.js";
const entries = data.entries;
</script>

<div class="blog-posts">
    <BlogEntry
        v-for="(item) in entries"
        :title="item.title"
        :description="item.description"
        :link="item.link"
        :date="item.date"
        :image="item.image"
    />
</div>
