# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/);
this project is pre-release, so everything lives under **Unreleased** for now.

## [Unreleased]

### Added

- **AI tool use (agentic loop)** — the chat assistant can call a
  `list_org_members` tool to answer questions it can't from the system prompt
  alone (e.g. "who are the admins of Acme?"). The model decides when to call it;
  the API runs it and **enforces authorization inside the tool** — a user can
  only list members of organizations they belong to, because the LLM is
  untrusted. The whole loop (model → tool call → result → answer) streams.
- **Streaming AI chat** — `POST /assistant/chat`: converse with the assistant
  about your workspace, with replies that **stream in token-by-token**.
  - API: streams from Gemini using an async generator (`stream: true`) written
    straight to the response with `@Res()` + `res.write`.
  - Web: a Next.js Route Handler (`/api/assistant/chat`) reads the httpOnly
    cookie, forwards the Bearer token to the API, and pipes the stream back to
    the browser — so the token never reaches client JS.
  - A client chat component renders tokens live and keeps multi-turn
    conversation state (the full history is sent each turn).
- **AI workspace summary** — `GET /assistant/summary`: a one-shot, server-side
  AI summary of the signed-in user's organizations and roles, plus a
  "✨ Summarize my workspace" button on the dashboard.
- **AI assistant module** wired to **Google Gemini** (free tier) via its
  OpenAI-compatible endpoint, using the `openai` SDK — provider-swappable by
  changing only the base URL + model.
- `GEMINI_API_KEY` (optional) added to the Zod-validated env config; the app
  boots without it and only the `/assistant` routes require it.

### Fixed

- Dashboard returned a 500 on an expired session because it cleared cookies
  during render (forbidden in Next.js 15). Cookie clearing moved into a
  `/logout` **Route Handler**, where mutation is allowed; the dashboard now
  redirects there.

### Changed

- README updated to cover the AI assistant, Swagger/OpenAPI docs, and the web
  session layer, plus the optional free Gemini key in the setup steps.
