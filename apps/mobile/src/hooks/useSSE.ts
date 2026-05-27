import { useState, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../services/config';

interface SSEOptions {
  conversationId?: string;
  onText?: (content: string) => void;
  onOrderPreview?: (order: any) => void;
  onSuggestions?: (suggestions: string[]) => void;
  onDone?: (data: { intent: string; fullResponse: string }) => void;
  onError?: (error: string) => void;
}

function createSSEParser(options: SSEOptions) {
  let buffer = '';
  let currentEvent = '';

  function dispatch(event: string, rawData: string) {
    try {
      const parsed = JSON.parse(rawData);
      const data = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;

      if (event === 'text') options.onText?.(data.content);
      else if (event === 'order_preview') options.onOrderPreview?.(data);
      else if (event === 'suggestions') options.onSuggestions?.(data);
      else if (event === 'done') options.onDone?.(data);
      else if (event === 'error') options.onError?.(data.error || '\u670d\u52a1\u7aef\u5904\u7406\u5931\u8d25');
    } catch (error: any) {
      options.onError?.(`SSE \u89e3\u6790\u5931\u8d25\uff1a${error.message}`);
    }
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const normalized = line.trimEnd();
        if (normalized === '') {
          currentEvent = '';
        } else if (normalized.startsWith('event:')) {
          currentEvent = normalized.slice(6).trim();
        } else if (normalized.startsWith('data:')) {
          dispatch(currentEvent, normalized.slice(5).trim());
        }
      }
    },
    flush() {
      if (buffer) this.push('\n');
    },
  };
}

function startSSERequest(url: string, token: string, message: string, options: SSEOptions) {
  const xhr = new XMLHttpRequest();
  const parser = createSSEParser(options);
  let readOffset = 0;

  const readNewText = () => {
    const text = xhr.responseText || '';
    if (text.length <= readOffset) return;
    parser.push(text.slice(readOffset));
    readOffset = text.length;
  };

  const done = new Promise<void>((resolve, reject) => {
    xhr.onprogress = readNewText;
    xhr.onload = () => {
      readNewText();
      parser.flush();
      console.log(`[SSE] Response status ${xhr.status}`);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      try {
        const error = JSON.parse(xhr.responseText);
        reject(new Error(error.error || `HTTP ${xhr.status}`));
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('\u7f51\u7edc\u8bf7\u6c42\u5931\u8d25'));
    xhr.ontimeout = () => reject(new Error(`\u8bf7\u6c42\u8d85\u65f6\uff1a\u65e0\u6cd5\u8fde\u63a5 ${API_BASE}`));
    xhr.onabort = () => reject(new Error('\u8bf7\u6c42\u5df2\u53d6\u6d88'));
  });

  xhr.open('POST', url);
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.timeout = 30000;
  xhr.send(JSON.stringify({ conversationId: options.conversationId, message }));

  return { xhr, done };
}

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const send = useCallback(async (message: string, options: SSEOptions) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) throw new Error('Not authenticated');

    setIsStreaming(true);

    try {
      const url = `${API_BASE}/api/chat/stream`;
      console.log(`[SSE] POST ${url}`);
      const request = startSSERequest(url, token, message, options);
      xhrRef.current = request.xhr;
      await request.done;
    } finally {
      setIsStreaming(false);
      xhrRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { send, cancel, isStreaming };
}
