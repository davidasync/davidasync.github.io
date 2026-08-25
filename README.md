# Portfolio

A terminal-inspired, single-page developer portfolio: hero, about, skills, engineering work,
experience, and contact. Built with Next.js 16 (App Router), TypeScript, and Tailwind CSS v4.
No UI dependencies beyond those — every component is local.

## Run it

```bash
npm run lint
npm run dev     # http://localhost:3000
npm run build   # static export in ./out
python3 -m http.server 8000 -d out
```

## Make it yours

All copy lives in one file: **`src/content/site.ts`**. Edit it and the whole page updates.

| What to change              | Where in `site.ts`         |
| --------------------------- | -------------------------- |
| Name, role, contact, location | `profile`                |
| GitHub / LinkedIn / Medium links | `socials`             |
| Bio paragraphs, quick facts | `about`                    |
| Tech pills                  | `skillGroups`              |
| Engineering highlight cards | `projects`                |
| Work history                | `experience`               |
| Nav labels                  | `navLinks`                 |

The current copy is based on davidasync's public LinkedIn and GitHub profiles. Review the
dates and descriptions before publishing, and add any results or context that should be
included.

Replace `src/app/favicon.ico` with the final site icon before publishing.

## Styling

Colours are CSS variables in `src/app/globals.css`, defined once for light mode on `:root`
and overridden under `.dark`. Change `--accent` to re-theme the whole site. Tailwind reads
them through the `@theme inline` block, so utilities like `bg-accent` and `text-muted` work
everywhere. Terminal chrome is shared through `src/components/TerminalWindow.tsx`.

Dark mode is class-based. A small inline script in `src/app/layout.tsx` applies the saved
preference before first paint, so there is no flash of the wrong theme; the toggle in the
nav writes to `localStorage`.

Scroll-in animations come from `src/components/Reveal.tsx` (an `IntersectionObserver` plus a
CSS transition). They are gated behind a `.js` class and disabled under
`prefers-reduced-motion`, so the page still reads fine without JavaScript.

## Deploy

The site is exported as static HTML and deployed to GitHub Pages. Every push to `main`
triggers `.github/workflows/deploy.yml`, which builds the site and publishes the `out`
directory.

Production: [https://davidasync.github.io](https://davidasync.github.io)
