import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, SafeAreaView } from 'react-native';

const mockProducts = [
  { id: '1', name: '土豆', category: '根茎类', price: '2.5', refPrice: '2.3', change: '+8.7%', up: true },
  { id: '2', name: '西红柿', category: '茄果类', price: '3.0', refPrice: '3.2', change: '-6.3%', up: false },
  { id: '3', name: '白菜', category: '叶菜类', price: '1.2', refPrice: '1.2', change: '持平', up: false },
  { id: '4', name: '黄瓜', category: '瓜类', price: '2.8', refPrice: '2.7', change: '+3.7%', up: true },
];

export default function PricesScreen() {
  const [search, setSearch] = useState('');
  const filtered = search ? mockProducts.filter((p) => p.name.includes(search)) : mockProducts;
  return (
    <SafeAreaView style={styles.container}>
      <TextInput style={styles.search} placeholder="搜索商品..." placeholderTextColor="#bbb" value={search} onChangeText={setSearch} />
      <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <View style={styles.row}>
          <View>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.cat}>{item.category} · 参考价 ￥{item.refPrice}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.price}>￥{item.price}</Text>
            <Text style={[styles.change, { color: item.change === '持平' ? '#999' : item.up ? '#c62828' : '#2e7d32' }]}>{item.change}</Text>
          </View>
        </View>
      )} contentContainerStyle={styles.list} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  search: { height: 40, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', paddingHorizontal: 14, margin: 12, fontSize: 14 },
  list: { paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  cat: { fontSize: 11, color: '#aaa', marginTop: 3 },
  price: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  change: { fontSize: 11, marginTop: 2 },
});
