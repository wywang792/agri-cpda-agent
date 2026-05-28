import React, { useCallback, useRef, useEffect } from 'react';
import { View, FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useChat } from '../../src/hooks/useChat';
import { ChatBubble } from '../../src/components/ChatBubble';
import { QuickActions } from '../../src/components/QuickActions';
import { ChatInput } from '../../src/components/ChatInput';

export default function AgentScreen() {
  const { messages, sendMessage, streamingText, isStreaming } = useChat();
  const flatListRef = useRef<FlatList>(null);
  const shouldStickToBottomRef = useRef(true);
  const router = useRouter();

  useEffect(() => {
    SecureStore.getItemAsync('auth_token').then((token) => {
      if (!token) router.replace('/login');
    });
  }, [router]);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    shouldStickToBottomRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollToBottom(true);
    }
  }, [messages, streamingText, scrollToBottom]);

  const handleSendMessage = (message: string) => {
    shouldStickToBottomRef.current = true;
    return sendMessage(message);
  };

  const handleQuickAction = (action: string) => {
    const map: Record<string, string> = { orders: '查一下我今天的订单', quick_order: '我要下单', prices: '今天价格怎么样' };
    if (map[action]) handleSendMessage(map[action]);
  };

  const allMessages = [...messages];
  if (streamingText) allMessages.push({ id: 'streaming', role: 'assistant', content: streamingText, timestamp: new Date() });

  return (
    <SafeAreaView style={styles.container}>
      <QuickActions onPress={handleQuickAction} />
      <FlatList ref={flatListRef} data={allMessages} keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => {
          if (shouldStickToBottomRef.current) {
            scrollToBottom(false);
          }
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16} />
      <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  list: { paddingVertical: 8 },
});
