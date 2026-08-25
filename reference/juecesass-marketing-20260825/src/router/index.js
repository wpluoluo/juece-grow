import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    component: () => import("@/views/SiteLayout.vue"),
    children: [
      { path: "", name: "home", component: () => import("@/views/HomePage.vue") },
      { path: "solutions", name: "solutions", component: () => import("@/views/SolutionsPage.vue") },
      { path: "features", name: "features", component: () => import("@/views/FeaturesPage.vue") },
      { path: "pricing", name: "pricing", component: () => import("@/views/PricingPage.vue") },
      { path: "privacy", name: "privacy", component: () => import("@/views/PrivacyPage.vue") },
      { path: "terms", name: "terms", component: () => import("@/views/TermsPage.vue") },
      { path: "sitemap", name: "sitemap", component: () => import("@/views/SitemapPage.vue") },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
