import type { AnalyticsConfig } from "@dougborg/site-analytics";

/**
 * Visitor analytics for the reference site through @dougborg/site-analytics.
 *
 * The site is served from https://dougborg.org/solarized-ui/, the blog's origin, so it reports
 * under the blog's Umami website ID and links the blog's privacy page, whose notice covers the
 * whole origin (one website ID per origin; see dougborg/site-analytics docs/consumers.md). Keep
 * the package pinned to the blog's version so the pages send exactly what that notice lists.
 * The ID is public: it ships in every page. Setting this to undefined is the rollback: the build
 * then publishes no tracker, module, or privacy link.
 */
export const siteAnalytics: AnalyticsConfig | undefined = {
  websiteId: "86b4f907-4165-4c7b-9250-fe7402c5262f",
  collector: "https://stats.dougborg.net",
  hostname: "dougborg.org",
  // The blog declares no events, and its notice lists none; the theme control here carries no
  // data-analytics-event markup either.
  declaredEvents: [],
};

/** The blog's privacy page, which covers every page on dougborg.org. */
export const privacyUrl = "https://dougborg.org/privacy/";
