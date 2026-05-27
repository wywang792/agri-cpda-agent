import { useState, useCallback } from 'react';
import { useSSE } from './useSSE';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const { send, cancel, isStreaming } = useSSE();

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setStreamingText('');

    let fullResponse = '';
    try {
      await send(content, {
        onText: (chunk) => { fullResponse += chunk; setStreamingText(fullResponse); },
        onDone: (data) => {
          setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.fullResponse, timestamp: new Date() }]);
          setStreamingText('');
        },
        onError: (error) => {
          setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `错误：${error}`, timestamp: new Date() }]);
          setStreamingText('');
        },
      });
    } catch (error: any) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `错误：${error.message || '发送失败'}`,
        timestamp: new Date(),
      }]);
      setStreamingText('');
    }
  }, [send]);

  return { messages, sendMessage, streamingText, isStreaming, cancel };
}
