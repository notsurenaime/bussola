import type { MetadataRoute } from "next";

/**
 * The app is not a website.
 *
 * Everything behind `/` needs a session, so there is nothing here for a
 * crawler to index — and `/share/` in particular must stay out of search
 * results. The page itself already carries `noindex`; this is the belt to that
 * brace, for crawlers that read robots.txt but follow a link before fetching
 * the page's metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
