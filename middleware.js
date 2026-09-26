/**
 * Vercel Edge Middleware — device routing for asianproc.com
 *
 * Mobile / tablet  → Flutter Web at /m/
 * Desktop          → Angular (quotation_frontend)
 *
 * Invite / verify / reset open under /m/... on phones. Flutter treats those
 * routes as public (no login). Deploy a fresh `public/m/` after Flutter changes.
 *
 * Overrides for testing:
 *   ?force_mobile=1   — treat as mobile
 *   ?force_desktop=1  — treat as desktop
 */

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

function isFlutterPath(pathname) {
  return pathname === '/m' || pathname.startsWith('/m/');
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

  // Desktop opened /m → Angular home (use ?force_mobile=1 to preview Flutter on desktop)
  if (onFlutter && !mobile) {
    const dest = new URL('/', request.url);
    copySearchParams(url, dest, ['force_desktop']);
    return Response.redirect(dest, 302);
  }

  // Mobile on Angular routes → Flutter Web (incl. /accept-distributor-invite)
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
