'use client';

/**
 * Streaming chat (Client Component). Maintains the conversation in React state,
 * POSTs the whole history to our Next.js /api/assistant/chat proxy, and reads the
 * streamed reply with a ReadableStream reader — appending each chunk to the last
 * assistant message so the UI fills in token-by-token.
 */
import { type ChangeEvent, type FormEvent, useState } from 'react';
import type { ChatMessage } from '@saas/contracts';

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);

    // The history we send (state updates are async, so build it explicitly).
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    // Show the user turn + an empty assistant bubble we'll stream into.
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text().catch(() => '')) || 'The assistant could not respond.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Append the chunk to the LAST message (the assistant bubble).
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last) return prev;
          const copy = [...prev];
          copy[copy.length - 1] = { role: last.role, content: last.content + chunk };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      // Drop the empty assistant bubble we optimistically added.
      setMessages((prev) =>
        prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && m.content === '')),
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: '1.5rem' }}>
      <strong>AI chat</strong>
      <p className="muted" style={{ margin: '0.25rem 0 0' }}>
        Ask about your workspace — replies stream in live.
      </p>

      {messages.length > 0 && (
        <div className="chat-log">
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
            </div>
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <form className="chat-form" onSubmit={send} style={{ marginTop: '0.75rem' }}>
        <input
          value={input}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          placeholder='e.g. "What can I do in Acme?"'
          disabled={streaming}
          aria-label="Message the assistant"
        />
        <button type="submit" disabled={streaming || !input.trim()}>
          {streaming ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
