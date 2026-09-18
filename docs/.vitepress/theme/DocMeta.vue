<script setup>
import { computed } from "vue";
import { useData, useRoute } from "vitepress";
import manualManifest from "../manual-manifest.json";

const props = defineProps({
  home: { type: Boolean, default: false }
});

const repositoryUrl = "https://github.com/art0rz/code-terraform-docs";
const sourceManualUrl = `${repositoryUrl}/blob/main/Code-Terraform-DOCS-Manual.md`;
const publishedSiteUrl = "https://art0rz.github.io/code-terraform-docs";

const { frontmatter } = useData();
const route = useRoute();

const manualBuild = computed(() => props.home
  ? manualManifest.build
  : frontmatter.value.manualBuild);
const issueUrl = computed(() => {
  const relativePath = route.path
    .replace(/^\/code-terraform-docs(?=\/|$)/, "")
    .replace(/\.html$/, "")
    .replace(/\/index$/, "/");
  const pageUrl = `${publishedSiteUrl}${relativePath}`;
  const params = new URLSearchParams({
    title: `Docs: ${frontmatter.value.title}`,
    body: [
      `Documentation page: ${pageUrl}`,
      `Manual build: ${manualBuild.value}`,
      "",
      "What should be corrected or clarified?"
    ].join("\n")
  });
  return `${repositoryUrl}/issues/new?${params}`;
});
</script>

<template>
  <div v-if="manualBuild" class="doc-meta" :class="{ 'home-doc-meta': home }">
    <span>Manual build <code>{{ manualBuild }}</code></span>
    <a :href="repositoryUrl">GitHub repository</a>
    <a :href="sourceManualUrl">Source manual</a>
    <a :href="issueUrl">Report an issue</a>
  </div>
</template>
