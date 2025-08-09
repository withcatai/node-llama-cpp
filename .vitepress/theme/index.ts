/* eslint-disable import/order */
import "./smoothLoad.css";

import {h} from "vue";
import Theme from "vitepress/theme";
import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import "@shikijs/vitepress-twoslash/style.css";
import LatestVersionHomeBadge from "../components/LatestVersionHomeBadge/LatestVersionHomeBadge.vue";
import CommentsSection from "../components/CommentsSection/CommentsSection.vue";
import {NolebaseGitChangelogPlugin} from "@nolebase/vitepress-plugin-git-changelog/client";
import LayoutContainer from "./LayoutContainer.vue";
import YouTubePlayer from "../components/YouTubePlayer/YouTubePlayer.vue";

import "./style.css";
import "@nolebase/vitepress-plugin-git-changelog/client/style.css";

import type {EnhanceAppContext} from "vitepress";

export default {
    extends: Theme,
    Layout: () => {
        const text = "gpt-oss is here!";
        const link = "/blog/v3.12-gpt-oss";
        const hideDate = new Date("2025-11-01T00:00:00Z");

        return h(LayoutContainer, null, h(Theme.Layout, null, {
            "home-hero-info-before": () => h(LatestVersionHomeBadge, {
                type: "desktop",
                text, link, hideDate
            }),
            "home-hero-actions-after": () => h(LatestVersionHomeBadge, {
                type: "mobile",
                text, link, hideDate
            }),
            "doc-after": () => h(CommentsSection)
        }));
    },
    enhanceApp({app, router, siteData}: EnhanceAppContext) {
        app.component("YouTubePlayer", YouTubePlayer);
        app.use(TwoslashFloatingVue);
        app.use(NolebaseGitChangelogPlugin, {
            displayAuthorsInsideCommitLine: true,
            hideChangelogHeader: true,
            hideSortBy: true,
            hideContributorsHeader: true
        });
    }
};
