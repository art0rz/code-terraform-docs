import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import DocMeta from "./DocMeta.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    "doc-after": () => h(DocMeta),
    "home-features-after": () => h(DocMeta, { home: true })
  })
};
