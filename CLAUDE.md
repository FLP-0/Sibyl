# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Build production bundle
npm run lint     # Run ESLint (Next.js + TypeScript rules)
npm start        # Run production server
```

No test runner is configured yet.

## Architecture

This is a **Next.js 16** app using the **App Router** with **React 19** and **Tailwind CSS 4**, deployed on **Upsun** (Node.js 20).

Source lives under `src/app/` following App Router conventions — layouts, pages, and route segments are colocated there. The path alias `@/*` resolves to `./src/*`.

Styling uses utility-first Tailwind with CSS custom properties (`--background`, `--foreground`, font vars) defined in `globals.css`. Dark mode is handled via `prefers-color-scheme` media query on `:root` overrides, not a class toggle.

Deployment is configured in `.upsun/config.yaml`: build runs `npm install && npm run build`, web process runs `npm start`.

## Key Conventions

- TypeScript strict mode is on — no `any` shortcuts
- Use `@/` imports rather than relative paths across module boundaries
- ESLint enforces `next/core-web-vitals` and `next/typescript` rule sets — run lint before committing
- Next.js 16 has breaking changes from prior versions; read `node_modules/next/dist/docs/` for current API before using any Next.js feature
