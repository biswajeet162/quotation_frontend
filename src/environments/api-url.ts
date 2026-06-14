const LOCAL_API_URL = 'http://localhost:8080';
const PROD_API_URL = 'https://quotation-backend-production-305c.up.railway.app';

/** Local dev uses port 8080; deployed builds call the Railway backend. */
export function resolveApiUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return LOCAL_API_URL;
    }
  }

  return PROD_API_URL;
}
