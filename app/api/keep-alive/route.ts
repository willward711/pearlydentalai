import { supabase } from '@/lib/supabase'

// Pinged daily by the Vercel cron in vercel.json so the free-tier Supabase
// project never hits its 7-day inactivity pause.
export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await supabase
    .from('chat_sessions')
    .select('id')
    .limit(1)

  // Fall back to the auth health endpoint so the ping still registers as
  // project activity even if the table is missing or renamed.
  let healthOk = false
  if (error) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } },
    )
    healthOk = res.ok
  }

  return Response.json({
    ok: !error || healthOk,
    tableError: error?.message ?? null,
    pingedAt: new Date().toISOString(),
  })
}
