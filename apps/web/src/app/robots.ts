import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';
import { SITE_URL, CANONICAL_HOST } from '@/lib/seo';

// Reading headers() makes this route dynamic (rendered per-request) — that's
// intended, so a tunnel/staging host served alongside the canonical one gets
// a fully-disallowed robots.txt instead of the real one.
export default function robots(): MetadataRoute.Robots {
  const host = headers().get('host')?.split(':')[0] || '';

  if (host !== CANONICAL_HOST) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
      {
        // AI/LLM crawlers — explicitly allowed for GEO (AI Overviews, ChatGPT, Perplexity, Copilot, etc.)
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'OAI-SearchBot',
          'ClaudeBot',
          'Claude-Web',
          'Claude-SearchBot',
          'Claude-User',
          'anthropic-ai',
          'PerplexityBot',
          'Perplexity-User',
          'Google-Extended',
          'Applebot-Extended',
        ],
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: CANONICAL_HOST,
  };
}
