import {h} from "vue";
import Theme from "vitepress/theme";
import "./style.css";

export default {
    extends: Theme,
    Layout: () => {
        return h(Theme.Layout, null, {});
    },
    enhanceApp({app, router, siteData}) {}
};
