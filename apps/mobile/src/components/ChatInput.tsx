import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function ChatInput({ onSend, onVoice, disabled }: { onSend: (msg: string) => void; onVoice?: () => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="说点什么..."
        placeholderTextColor="#bbb"
        editable={!disabled}
        onSubmitEditing={handleSend}
        returnKeyType="send"
      />
      {hasText ? (
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={disabled}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.voiceBtn} onPress={onVoice} disabled={disabled}>
          <Ionicons name="mic" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#333',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});