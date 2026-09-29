export const STORAGE_KEYS = {
  token: 'quotation_auth_token',
  user: 'quotation_auth_user',
  /** Session-only flag: show the APS welcome splash after the next navigation into the app shell. */
  welcomeSplashPending: 'aps_welcome_splash_pending',
  /** Per-salesperson CRM “recently opened” map (survives refresh; hourly sync to backend). */
  crmRecentOpenedPrefix: 'aps_crm_recent_opened_',
} as const;
