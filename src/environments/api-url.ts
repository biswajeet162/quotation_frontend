const LOCAL_API_URL = 'http://localhost:8080';
const PROD_API_URL = 'https://api.asianproc.com';

/** Local dev uses port 8080; deployed builds call the Hostinger VPS API. */
export function resolveApiUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    if (
      port === '4200' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      return LOCAL_API_URL;
    }
  }

  return PROD_API_URL;
}
