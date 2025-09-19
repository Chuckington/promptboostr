import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // This response object will be used to pass cookies to the browser.
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create a Supabase client that can be used in Server Components, server-side
  // functions, and middleware.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name:string, value: string, options: CookieOptions) {
          // The `set` method is called whenever the Supabase client needs to
          // set a cookie. This is called when signing in, signing out, and
  // refreshing the session.
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // The `remove` method is called whenever the Supabase client needs to
          // remove a cookie. This is called when signing out.
          response.cookies.delete({ name, ...options })
        },
      },
    }
  )

  // This will refresh the session cookie if it's expired.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Define paths that are public. All other paths are protected.
  // The root path '/' is often public, add or remove paths as needed.
  const publicPaths = ['/login', '/']
  const isPublicPath = publicPaths.includes(pathname)

  // If the user is logged in and on the login page, redirect to the main protected route.
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/wizard', request.url))
  }

  // If the path is protected and the user is not logged in, redirect to login.
  if (!isPublicPath && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Allow the request to continue.
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}