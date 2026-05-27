import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function QuickActions({ onPress }: { onPress: (action: string) => void }) {
  const actions = [
    { key: 'orders', label: '今日订单', icon: 'cube' as const },
    { key: 'quick_order', label: '快速下单', icon: 'flash' as const },
    { key: 'prices', label: '价格看板', icon: 'pricetag' as const },
  ];
  return (
    <View style={styles.container}>
      {actions.map((a) => (
        <TouchableOpacity key={a.key} style={styles.action} onPress={() => onPress(a.key)}>
          <Ionicons name={a.icon} size={18} color="#666" />
          <Text style={styles.label}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', gap: 4 },
  label: { fontSize: 11, color: '#666' },
});
