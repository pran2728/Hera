# Hera

Hera is a free AI companion for menstrual cycle and women's health. Instead of logging into forms, women just talk to her: "got my period this morning" is a complete log. Hera checks in on her own, gives phase-based food and water guidance for Indian diets, and, with permission, nudges a partner on how to show up that week.

Named after Hera, queen of the gods in Greek mythology and protector of women.

## Status

Milestone 1, stage 9a: app shell, installable web app, and email login.

## Stack (all free tiers)

| Part | Tool |
| --- | --- |
| App | React + Vite, installable as a Progressive Web App |
| Hosting | Vercel |
| Login, database, chat function | Supabase |
| AI | Google Gemini, called only from a Supabase Edge Function |

## Privacy

Secret keys never live in this repo. The Gemini key is stored as a Supabase secret, and the app only ships Supabase's public URL and publishable key.

## Run locally

```bash
cp .env.example .env   # fill in your Supabase URL and publishable key
npm install
npm run dev
```
