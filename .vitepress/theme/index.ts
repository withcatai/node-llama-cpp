import {h} from "vue";
import Theme from "vitepress/theme";
import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import "@shikijs/vitepress-twoslash/style.css";
import "./style.css";

import type {EnhanceAppContext} from "vitepress";

export default {
    extends: Theme,
    Layout: () => {
        return h(Theme.Layout, null, {});
    },
    enhanceApp({app, router, siteData}: EnhanceAppContext) {
        // @ts-ignore
        app.use(TwoslashFloatingVue);
    }
};
