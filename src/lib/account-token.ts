const TOKEN_PATTERN = /^[a-f0-9]{48}$/;

/** Tokens issued by invite and reset flows use 24 random bytes encoded as lowercase hex. */
export function isAccountToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** Expiration is exclusive: a token is no longer valid at its expiry instant. */
export function isExpiredAt(expiresAt: Date | null, now: Date) {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}
