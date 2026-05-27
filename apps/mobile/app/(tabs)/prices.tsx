import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { listProducts, type ProductPriceDto } from '../../src/services/products';

export default function PricesScreen() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductPriceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const handle = setTimeout(() => {
      setLoading(true);
      setError('');

      listProducts(search.trim() || undefined)
        .then((rows) => {
          if (!mounted) return;
          setProducts(rows);
        })
        .catch((e: any) => {
          if (!mounted) return;
          setError(e.message || '加载商品失败');
          setProducts([]);
        })
        .finally(() => {
          if (!mounted) return;
          setLoading(false);
        });
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(handle);
    };
  }, [search]);

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="搜索商品..."
        placeholderTextColor="#bbb"
        value={search}
        onChangeText={setSearch}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.loading} color="#1a1a1a" /> : null}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const price = item.supplierPrice ?? item.referencePrice;
          return (
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.cat}>{item.category} · 参考价 ￥{item.referencePrice}/{item.unit}</Text>
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.price}>￥{price}</Text>
                <Text style={styles.change}>库存 {item.stock ?? '-'}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>暂无商品</Text> : null}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  search: { height: 40, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', paddingHorizontal: 14, margin: 12, fontSize: 14 },
  loading: { marginBottom: 8 },
  error: { color: '#c62828', paddingHorizontal: 14, marginBottom: 8, fontSize: 12 },
  list: { paddingHorizontal: 14, paddingBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  info: { flex: 1, paddingRight: 12 },
  name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  cat: { fontSize: 11, color: '#888', marginTop: 3 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  change: { fontSize: 11, marginTop: 2, color: '#777' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 13 },
});
