import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ChatMessage } from '../hooks/useChat';

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 4, paddingHorizontal: 14 },
  userContainer: { alignItems: 'flex-end' },
  assistantContainer: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 14 },
  userBubble: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#1a1a1a', borderBottomLeftRadius: 4 },
  text: { fontSize: 14, lineHeight: 21 },
  userText: { color: '#333' },
  assistantText: { color: '#fff' },
});
