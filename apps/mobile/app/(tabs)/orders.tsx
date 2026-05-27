import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

const mockOrders = [
  { id: '1', orderNo: 'ORD-20260527-0001', items: '土豆100斤 + 西红柿50斤', status: 'pending', statusText: '待确认', party: '王记蔬果', price: '400', statusColor: '#fff8e1', textColor: '#b8860b', borderColor: '#ffe082' },
  { id: '2', orderNo: 'ORD-20260526-0002', items: '白菜200斤', status: 'completed', statusText: '已完成', party: '张三批发', price: '240', statusColor: '#f0f0f0', textColor: '#666', borderColor: '#e0e0e0' },
  { id: '3', orderNo: 'ORD-20260526-0003', items: '胡萝卜150斤 + 黄瓜80斤', status: 'delivering', statusText: '配送中', party: '李记蔬菜', price: '524', statusColor: '#e8f5e9', textColor: '#558b2f', borderColor: '#c8e6c9' },
];

const filters = ['全部', '待确认', '进行中', '已完成'];

export default function OrdersScreen() {
  const [active, setActive] = useState('全部');
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filters}>
        {filters.map((f) => (
          <TouchableOpacity key={f} style={[styles.chip, active === f && styles.chipActive]} onPress={() => setActive(f)}>
            <Text style={[styles.chipText, active === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={mockOrders} keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.orderNo}>#{item.orderNo}</Text>
            <View style={[styles.tag, { backgroundColor: item.statusColor, borderColor: item.borderColor }]}>
              <Text style={[styles.tagText, { color: item.textColor }]}>{item.statusText}</Text>
            </View>
          </View>
          <Text style={styles.items}>{item.items}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.party}>{item.party}</Text>
            <Text style={styles.price}>￥{item.price}</Text>
          </View>
        </TouchableOpacity>
      )} contentContainerStyle={styles.list} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  filters: { flexDirection: 'row', padding: 12, gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  chipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipText: { fontSize: 12, color: '#666' },
  chipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontWeight: '600', fontSize: 13, color: '#1a1a1a' },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '600' },
  items: { color: '#888', fontSize: 12, marginTop: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  party: { color: '#aaa', fontSize: 11 },
  price: { fontWeight: '700', color: '#1a1a1a', fontSize: 14 },
});
