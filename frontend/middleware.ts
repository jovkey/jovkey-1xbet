import { NextRequest, NextResponse } from 'next/server';

/**
 * Sécurité d'accès : les routes admin "classiques" sont bannies (404).
 * /admin, /administrator, /wp-admin... → rewrite vers /not-found.
 * Il n'existe aucune page admin dédiée : le panel s'affiche dans /dashboard
 * uniquement pour les rôles admin/superadmin (routage par rôle, protégé côté API).
 */
const BANNED = ['/admin', '/administrator', '/wp-admin', '/dashboard-admin', '/backoffice'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (BANNED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.rewrite(new URL('/not-found', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/administrator/:path*', '/wp-admin/:path*', '/backoffice/:path*'],
};
