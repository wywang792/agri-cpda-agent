import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function ProfileScreen() {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const name = await SecureStore.getItemAsync('username');
      const r = await SecureStore.getItemAsync('user_role');
      setUsername(name || '用户');
      setRole(r === 'buyer' ? '采购商' : '供应商');
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: async () => { await SecureStore.deleteItemAsync('auth_token'); router.replace('/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.name}>{username}</Text>
        <Text style={styles.role}>{role}</Text>
      </View>
      <View style={styles.menu}>
        {['账户设置', '通知设置', '关于我们'].map((item) => (
          <TouchableOpacity key={item} style={styles.menuItem}>
            <Text style={styles.menuText}>{item}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: { alignItems: 'center', padding: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: '#666', fontSize: 22, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  role: { fontSize: 12, color: '#999', marginTop: 3 },
  menu: { marginTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuText: { fontSize: 14, color: '#333' },
  arrow: { color: '#ccc', fontSize: 16 },
  logoutBtn: { margin: 16, padding: 14, backgroundColor: '#fafafa', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  logoutText: { color: '#999', fontSize: 14 },
});
