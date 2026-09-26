/**
 * Vercel Edge Middleware — device routing for asianproc.com
 *
 * Mobile / tablet  → Flutter Web at /m/
 * Desktop          → Angular (quotation_frontend)
 *
 * Invite / verify / reset links are PUBLIC (no login) on every device:
 *   /accept-distributor-invite
 *   /accept-customer-invite   (reserved)
 *   /verify-email, /reset-password, /forgot-password
 *
 * Phone:  /accept-…  →  /m/accept-…  (Flutter public screen)
 * Desktop on /m/accept-…  →  /accept-…  (Angular public screen, never home)
 *
 * Overrides:
 *   ?force_mobile=1   — treat as mobile
 *   ?force_desktop=1  — treat as desktop
 */

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

/** Paths that must never require login (email / invite deep links). */
const PUBLIC_NO_AUTH_PATHS = new Set([
  '/accept-distributor-invite',
  '/accept-customer-invite',
  '/invite/distributor',
  '/invite/customer',
  '/verify-email',
  '/reset-password',
  '/forgot-password',
]);

function isFlutterPath(pathname) {
  return pathname === '/m' || pathname.startsWith('/m/');
}

function stripMobilePrefix(pathname) {
  if (pathname === '/m' || pathname === '/m/') return '/';
  if (pathname.startsWith('/m/')) return pathname.slice(2); // '/m/foo' → '/foo'
  return pathname;
}

function isPublicNoAuthPath(pathname) {
  const p = stripMobilePrefix(pathname);
  if (PUBLIC_NO_AUTH_PATHS.has(p)) return true;
  return (
    p.startsWith('/accept-distributor-invite') ||
    p.startsWith('/accept-customer-invite') ||
    p.startsWith('/invite/')
  );
}

function isStaticAssetPath(pathname) {
  if (pathname === '/favicon.ico' || pathname === '/robots.txt') return true;
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/branding/') ||
    pathname.startsWith('/images/')
  ) {
    return true;
  }
  const last = pathname.split('/').pop() || '';
  return last.includes('.');
}

function isMobileRequest(request, url) {
  if (url.searchParams.get('force_desktop') === '1') return false;
  if (url.searchParams.get('force_mobile') === '1') return true;

  const chMobile = request.headers.get('sec-ch-ua-mobile');
  if (chMobile === '?1') return true;
  if (chMobile === '?0') {
    const ua = request.headers.get('user-agent') || '';
    return /iPad|Tablet/i.test(ua);
  }

  const ua = request.headers.get('user-agent') || '';
  return MOBILE_UA.test(ua);
}

function mapAngularPathToFlutter(pathname) {
  if (!pathname || pathname === '/') return '/m/';
  return '/m' + (pathname.startsWith('/') ? pathname : `/${pathname}`);
}

function copySearchParams(fromUrl, toUrl, skipKeys = []) {
  const skip = new Set(skipKeys);
  for (const [key, value] of fromUrl.searchParams.entries()) {
    if (!skip.has(key)) toUrl.searchParams.set(key, value);
  }
}

export default function middleware(request) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (isStaticAssetPath(pathname)) {
    return;
  }

  const mobile = isMobileRequest(request, url);
  const onFlutter = isFlutterPath(pathname);

  // Desktop opened /m/... — public invite/auth links go to Angular (keep token).
  // Other /m pages go to Angular home.
  if (onFlutter && !mobile) {
    if (isPublicNoAuthPath(pathname)) {
      const dest = new URL(stripMobilePrefix(pathname), request.url);
      copySearchParams(url, dest, ['force_desktop', 'force_mobile']);
      return Response.redirect(dest, 302);
    }
    const dest = new URL('/', request.url);
    copySearchParams(url, dest, ['force_desktop']);
    return Response.redirect(dest, 302);
  }

  // Mobile on Angular routes → Flutter Web (public invite stays public under /m/)
  if (!onFlutter && mobile) {
    const dest = new URL(mapAngularPathToFlutter(pathname), request.url);
    copySearchParams(url, dest, ['force_mobile']);
    return Response.redirect(dest, 302);
  }
}

export const config = {
  matcher: [
    '/',
    '/((?!assets/|branding/|images/|favicon\\.ico|robots\\.txt).*)',
  ],
};
