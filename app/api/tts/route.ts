export const maxDuration = 30

// Hard cap on input length to bound per-request cost (Pearly replies are ~300 chars)
const MAX_TTS_CHARS = 4000

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}))

  if (!text || typeof text !== 'string' || !text.trim()) {
    return new Response('Missing text', { status: 400 })
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'nova',
      input: text.slice(0, MAX_TTS_CHARS),
      instructions:
        'You are Pearly, a warm, cheerful, friendly dental health assistant. Speak in an upbeat, encouraging, approachable tone, like a kind receptionist at a dental office.',
      response_format: 'mp3',
    }),
    signal: req.signal,
  })

  if (!response.ok || !response.body) {
    return new Response('Speech generation failed', { status: 502 })
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
