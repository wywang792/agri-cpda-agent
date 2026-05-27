import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../src/services/auth';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!username || !password) { Alert.alert('提示', '请输入用户名和密码'); return; }
    setLoading(true);
    try {
      await login({ username, password });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('登录失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logo}><Text style={styles.logoText}>鲜</Text></View>
        <Text style={styles.title}>鲜达通</Text>
        <Text style={styles.subtitle}>农产品智能订单助手</Text>
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="请输入用户名" placeholderTextColor="#bbb" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="请输入密码" placeholderTextColor="#bbb" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.btnText}>{loading ? '登录中...' : '登 录'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { width: 56, height: 56, backgroundColor: '#1a1a1a', borderRadius: 14, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', letterSpacing: 1 },
  subtitle: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 4, marginBottom: 32 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#eee' },
  input: { backgroundColor: '#f7f7f7', borderRadius: 8, padding: 11, fontSize: 14, marginBottom: 10, color: '#333' },
  btn: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 1 },
});
