import type { Metadata } from 'next'
import ChatInterface from '@/components/chat-interface'

export const metadata: Metadata = {
  title: 'Chat with Pearly',
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  return <ChatInterface initialQuestion={q} />
}
