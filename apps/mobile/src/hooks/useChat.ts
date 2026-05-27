import { useState, useCallback, useEffect } from 'react';
import { useSSE } from './useSSE';
import { getCurrentConversation, type ConversationMessage } from '../services/chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function toChatMessage(message: ConversationMessage, index: number): ChatMessage | null {
  if (message.role !== 'user' && message.role !== 'assistant') {
    return null;
  }

  const timestamp = Number.isNaN(Date.parse(message.timestamp))
    ? new Date()
    : new Date(message.timestamp);

  return {
    id: `${message.timestamp}-${index}`,
    role: message.role,
    content: message.content,
    timestamp,
  };
}

export function useChat() {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const { send, cancel, isStreaming } = useSSE();

  useEffect(() => {
    let isActive = true;

    getCurrentConversation()
      .then((conversation) => {
        if (!isActive) return;

        setConversationId(conversation.conversationId);
        setMessages(
          conversation.messages
            .map(toChatMessage)
            .filter((message): message is ChatMessage => message !== null),
        );
      })
      .catch((error: any) => {
        console.warn('[Chat] Failed to load current conversation:', error.message);
        if (!isActive) return;

        setMessages([{
          id: 'load-error',
          role: 'assistant',
          content: `加载会话失败：${error.message || '未知错误'}`,
          timestamp: new Date(),
        }]);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };

    setMessages((prev) => [...prev, userMsg]);
    setStreamingText('');

    let fullResponse = '';
    try {
      await send(content, {
        conversationId,
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

      if (!conversationId) {
        const conversation = await getCurrentConversation();
        setConversationId(conversation.conversationId);
      }
    } catch (error: any) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `错误：${error.message || '发送失败'}`,
        timestamp: new Date(),
      }]);
      setStreamingText('');
    }
  }, [conversationId, send]);

  return { messages, sendMessage, streamingText, isStreaming, cancel };
}
