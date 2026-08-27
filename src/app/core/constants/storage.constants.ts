export const STORAGE_KEYS = {
  token: 'quotation_auth_token',
  user: 'quotation_auth_user',
  /** Session-only flag: show the APS welcome splash after the next navigation into the app shell. */
  welcomeSplashPending: 'aps_welcome_splash_pending',
} as const;
