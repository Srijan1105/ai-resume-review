import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || !url.startsWith("http")) {
    return supabaseResponse;
  }

  // Create a Supabase client for the middleware (Edge runtime).
  // Cookie reads come from the incoming request; writes go to supabaseResponse.
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write updated cookies to the outgoing response so the browser
          // and subsequent server components see the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: calling getUser() refreshes the session cookie when it is
  // close to expiry. This must happen on every request so sessions stay alive.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect all /dashboard/* routes — redirect unauthenticated visitors to
  // the sign-in page. All other routes (marketing, auth, /api/*) pass through.
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/dashboard") && !user) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    return NextResponse.redirect(signInUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on every route except:
     *   - _next/static  (static asset files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico   (browser favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
