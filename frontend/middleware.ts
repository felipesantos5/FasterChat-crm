import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// const publicPaths = ["/login", "/signup", "/"];
// const protectedPaths = ["/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value || request.headers.get("authorization")?.split(" ")[1];

  // Check if path is protected
  // const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  // const isPublicPath = publicPaths.includes(pathname);

  // If accessing protected route without token, redirect to login
  // if (isProtectedPath && !token) {
  //   const loginUrl = new URL('/login', request.url);
  //   loginUrl.searchParams.set('redirect', pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  // If accessing login/signup with valid token, redirect to dashboard
  if ((pathname === "/login" || pathname === "/signup") && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
