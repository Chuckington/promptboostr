import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // This response object will be used to pass cookies to the browser.
  let response = NextResponse.next({
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

  // If the user is not signed in and they are trying to access a protected route,
  // redirect them to the login page.
  if (!user && request.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Return the response object, which may have an updated session cookie.
  return response
}

export const config = {
  matcher: ['/wizard'],
}