import React, { useRef, useEffect } from 'react';
import { View, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useChat } from '../../src/hooks/useChat';
import { ChatBubble } from '../../src/components/ChatBubble';
import { QuickActions } from '../../src/components/QuickActions';
import { ChatInput } from '../../src/components/ChatInput';

export default function AgentScreen() {
  const { messages, sendMessage, streamingText, isStreaming } = useChat();
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  useEffect(() => {
    SecureStore.getItemAsync('auth_token').then((token) => {
      if (!token) router.replace('/login');
    });
  }, [router]);

  useEffect(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, [messages, streamingText]);

  const handleQuickAction = (action: string) => {
    const map: Record<string, string> = { orders: '查一下我今天的订单', quick_order: '我要下单', prices: '今天价格怎么样' };
    if (map[action]) sendMessage(map[action]);
  };

  const allMessages = [...messages];
  if (streamingText) allMessages.push({ id: 'streaming', role: 'assistant', content: streamingText, timestamp: new Date() });

  return (
    <SafeAreaView style={styles.container}>
      <QuickActions onPress={handleQuickAction} />
      <FlatList ref={flatListRef} data={allMessages} keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.list} onContentSizeChange={() => flatListRef.current?.scrollToEnd()} />
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  list: { paddingVertical: 8 },
});
