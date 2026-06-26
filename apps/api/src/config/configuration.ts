import type { Env } from './env.validation';

/**
 * A typed accessor for config. Throughout the app we inject Nest's
 * ConfigService<Env, true> and read values with full autocomplete and type
 * safety, e.g. `config.get('JWT_ACCESS_SECRET', { infer: true })`.
 *
 * This file exists mostly as the home for the `Env` type alias so feature
 * modules import config typing from one place.
 */
export type AppConfig = Env;
