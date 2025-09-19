import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // if user is not signed in and the current path is not /login, redirect the user to /login
  if (!user && request.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/wizard'],
}