/**
 * @saas/contracts — the single source of truth for the *shapes* of data that
 * cross the network boundary between the web app and the API.
 *
 * Why a shared package?
 *  - The frontend builds a login form; the backend validates the login body.
 *    If they disagree about field names or rules, you get runtime bugs.
 *  - By defining each schema with Zod ONCE here, both sides import the same
 *    rules. The backend uses them to validate requests; the frontend uses them
 *    to validate forms and to get TypeScript types for API responses.
 *
 * Pattern: define a Zod schema, then derive the TS type from it with
 * `z.infer`. The schema and the type can never drift apart.
 *
 * This package ships TypeScript *source* (no build step). The apps that import
 * it (Next.js and NestJS) compile it as part of their own bundles, so imports
 * here are extensionless and resolved by each app's bundler.
 */
export * from './common';
export * from './user';
export * from './organization';
export * from './document';
export * from './auth';
export * from './assistant';
