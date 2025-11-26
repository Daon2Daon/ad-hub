import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

const protectedMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (token.status && token.status !== "active") {
      const pendingUrl = new URL("/login", req.url);
      pendingUrl.searchParams.set("status", "pending");
      return NextResponse.redirect(pendingUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  },
);

export default protectedMiddleware;

export const config = {
  matcher: ["/((?!api/auth|login|signup|_next/static|_next/image|favicon.ico).*)"],
};
