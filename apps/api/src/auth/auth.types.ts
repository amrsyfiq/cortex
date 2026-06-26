/**
 * Shared types for the auth layer.
 */

/** What we encode INSIDE a JWT. Keep it small — it's sent on every request. */
export interface JwtPayload {
  /** Subject = the user id. "sub" is the standard JWT claim for this. */
  sub: string;
  email: string;
}

/**
 * The object Passport puts on `request.user` after validating an ACCESS token.
 * This is what @CurrentUser() returns.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * For the REFRESH route we also carry the raw refresh token so the service can
 * compare it against the hash stored in the DB (rotation + revocation).
 */
export interface AuthenticatedUserWithRefreshToken extends AuthenticatedUser {
  refreshToken: string;
}
