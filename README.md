# davidasync.github.io

Personal site for [davidasync](https://davidasync.github.io): a terminal-styled portfolio plus a few browser developer tools. Processing in `/dev-tools/` stays on the device, apart from the two tools that have to leave it: diff share links and the URL shortener.

**Live:** [https://davidasync.github.io](https://davidasync.github.io)

## What’s here

- Portfolio: about, skills, work, experience, contact
- [Developer tools](https://davidasync.github.io/dev-tools/): JSON, YAML, and XML beautifiers, text diff, Base64, string escape/unescape, a JWT debugger, and a URL shortener

Site copy lives in `src/content/site.ts`. Colours and theme tokens live in `src/app/globals.css`.

The shortener calls [nikednep](https://github.com/davidasync/nikednep), an API-only URL
shortener on Cloudflare Workers. It defaults to `https://nikednep.davidasync.workers.dev`;
set `NEXT_PUBLIC_SHORTENER_URL` at build time to point it somewhere else. That worker must
allowlist this site's origin for CORS, or the browser blocks the call at the preflight.

## Stack

Next.js 16 (static export), React 19, TypeScript, Tailwind CSS v4. GitHub Pages publishes the `out` directory from `.github/workflows/deploy.yml` on every push to `main`.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build    # static export in ./out
```
