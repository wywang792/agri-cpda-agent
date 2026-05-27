import { useState, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';

interface SSEOptions {
  onText?: (content: string) => void;
  onOrderPreview?: (order: any) => void;
  onSuggestions?: (suggestions: string[]) => void;
  onDone?: (data: { intent: string; fullResponse: string }) => void;
  onError?: (error: string) => void;
}

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (message: string, options: SSEOptions) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) throw new Error('Not authenticated');

    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
          else if (line.startsWith('data:')) {
            try {
              const parsed = JSON.parse(line.slice(5).trim());
              const inner = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
              if (currentEvent === 'text') options.onText?.(inner.content);
              else if (currentEvent === 'order_preview') options.onOrderPreview?.(inner);
              else if (currentEvent === 'suggestions') options.onSuggestions?.(inner);
              else if (currentEvent === 'done') options.onDone?.(inner);
              else if (currentEvent === 'error') options.onError?.(inner.error);
            } catch {}
          }
        }
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const cancel = useCallback(() => { abortRef.current?.abort(); setIsStreaming(false); }, []);
  return { send, cancel, isStreaming };
}
