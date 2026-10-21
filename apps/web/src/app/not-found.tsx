/**
 * Fallback for URLs that never reach the localised routes (the middleware skips paths with a
 * file extension, /api and /uploads). Everything else is a 404 rendered by
 * app/[locale]/not-found.tsx via the catch-all route, in the visitor's language.
 *
 * Plain markup on purpose: `next/error` is a class component and cannot be rendered here.
 */
export default function GlobalNotFound() {
  return (
    <html lang="de-CH">
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: 16, fontWeight: 400 }}>
            <b style={{ fontSize: 24, marginRight: 16 }}>404</b>
            HoppDrive
          </h1>
        </main>
      </body>
    </html>
  );
}
