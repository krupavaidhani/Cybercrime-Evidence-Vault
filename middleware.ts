import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Simple redirect for root path to login
    if (request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Note: Full auth protection is handled by RoleGuard (client-side) 
    // because Firebase Auth tokens are not easily accessible in Middleware
    // without a session cookie implementation.

    return NextResponse.next();
}

export const config = {
    matcher: ['/'],
};
