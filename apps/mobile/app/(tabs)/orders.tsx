import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listOrders, type OrderDto } from '../../src/services/orders';

const filters = ['全部', '待确认', '进行中', '已完成'];

const statusMeta: Record<string, { text: string; statusColor: string; textColor: string; borderColor: string }> = {
  pending: { text: '待确认', statusColor: '#fff8e1', textColor: '#b8860b', borderColor: '#ffe082' },
  confirmed: { text: '已确认', statusColor: '#e8f5e9', textColor: '#558b2f', borderColor: '#c8e6c9' },
  sorting: { text: '分拣中', statusColor: '#e3f2fd', textColor: '#1565c0', borderColor: '#bbdefb' },
  sorted: { text: '已分拣', statusColor: '#e3f2fd', textColor: '#1565c0', borderColor: '#bbdefb' },
  delivering: { text: '配送中', statusColor: '#e8f5e9', textColor: '#558b2f', borderColor: '#c8e6c9' },
  completed: { text: '已完成', statusColor: '#f0f0f0', textColor: '#666', borderColor: '#e0e0e0' },
  cancelled: { text: '已取消', statusColor: '#ffebee', textColor: '#c62828', borderColor: '#ffcdd2' },
};

function matchesFilter(order: OrderDto, active: string) {
  if (active === '全部') return true;
  if (active === '待确认') return order.status === 'pending';
  if (active === '已完成') return order.status === 'completed';
  return ['confirmed', 'sorting', 'sorted', 'delivering'].includes(order.status);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatDeliveryTime(order: OrderDto) {
  if (order.deliveryTimeText) return order.deliveryTimeText;
  if (!order.deliveryStartAt) return '-';

  const start = formatCreatedAt(order.deliveryStartAt);
  if (!order.deliveryEndAt) return start;
  return `${start} - ${formatCreatedAt(order.deliveryEndAt)}`;
}

export default function OrdersScreen() {
  const [active, setActive] = useState('全部');
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError('');

    listOrders()
      .then((rows) => {
        if (!mounted) return;
        setOrders(rows);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setError(e.message || '加载订单失败');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []));

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order, active)),
    [orders, active]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filters}>
        {filters.map((f) => (
          <TouchableOpacity key={f} style={[styles.chip, active === f && styles.chipActive]} onPress={() => setActive(f)}>
            <Text style={[styles.chipText, active === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.loading} color="#1a1a1a" /> : null}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const meta = statusMeta[item.status] || statusMeta.pending;
          const itemSummary = item.items
            .map((orderItem) => `${orderItem.productName}${orderItem.quantity}${orderItem.unit}`)
            .join(' + ');

          return (
            <TouchableOpacity style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderNo}>#{item.orderNo}</Text>
                <View style={[styles.tag, { backgroundColor: meta.statusColor, borderColor: meta.borderColor }]}>
                  <Text style={[styles.tagText, { color: meta.textColor }]}>{meta.text}</Text>
                </View>
              </View>
              <Text style={styles.items}>{itemSummary || '暂无商品明细'}</Text>
              {(item.deliveryContactName || item.deliveryContactPhone || item.deliveryAddress) && (
                <Text style={styles.deliveryText}>
                  {[item.deliveryContactName, item.deliveryContactPhone, item.deliveryAddress].filter(Boolean).join(' · ')}
                </Text>
              )}
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>配送：{formatDeliveryTime(item)}</Text>
                <Text style={styles.timeText}>创建：{formatCreatedAt(item.createdAt)}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.party}>{item.buyerName} · {item.supplierName}</Text>
                <Text style={styles.price}>￥{item.totalPrice}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>暂无订单</Text> : null}
        contentContainerStyle={styles.list}
      />
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
  loading: { marginBottom: 8 },
  error: { color: '#c62828', paddingHorizontal: 14, marginBottom: 8, fontSize: 12 },
  list: { paddingHorizontal: 14, paddingBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  orderNo: { flex: 1, fontWeight: '600', fontSize: 13, color: '#1a1a1a' },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '600' },
  items: { color: '#666', fontSize: 12, marginTop: 8 },
  deliveryText: { color: '#555', fontSize: 12, marginTop: 6, lineHeight: 18 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  timeText: { flex: 1, color: '#777', fontSize: 11 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  party: { flex: 1, color: '#888', fontSize: 11 },
  price: { fontWeight: '700', color: '#1a1a1a', fontSize: 14 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 13 },
});
