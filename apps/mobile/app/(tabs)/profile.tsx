import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  BuyerAddressDto,
  createBuyerAddress,
  deleteBuyerAddress,
  listBuyerAddresses,
  setDefaultBuyerAddress,
  updateBuyerAddress,
} from '../../src/services/buyerAddresses';

const emptyForm = {
  contactName: '',
  contactPhone: '',
  address: '',
  isDefault: false,
};

export default function ProfileScreen() {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [addresses, setAddresses] = useState<BuyerAddressDto[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<BuyerAddressDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  const isBuyer = roleKey === 'buyer';

  const loadAddresses = useCallback(async () => {
    if (!isBuyer) return;
    setLoadingAddresses(true);
    try {
      const data = await listBuyerAddresses();
      setAddresses(data);
    } catch (error: any) {
      Alert.alert('加载失败', error.message || '无法加载收货地址');
    } finally {
      setLoadingAddresses(false);
    }
  }, [isBuyer]);

  useEffect(() => {
    (async () => {
      const name = await SecureStore.getItemAsync('username');
      const r = await SecureStore.getItemAsync('user_role');
      setUsername(name || '用户');
      setRoleKey(r || '');
      setRole(r === 'buyer' ? '采购商' : '供应商');
    })();
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleLogout = () => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('auth_token');
          router.replace('/login');
        },
      },
    ]);
  };

  const openCreateModal = () => {
    setEditingAddress(null);
    setForm({ ...emptyForm, isDefault: addresses.length === 0 });
    setModalVisible(true);
  };

  const openEditModal = (address: BuyerAddressDto) => {
    setEditingAddress(address);
    setForm({
      contactName: address.contactName,
      contactPhone: address.contactPhone,
      address: address.address,
      isDefault: address.isDefault,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    if (savingAddress) return;
    setModalVisible(false);
    setEditingAddress(null);
    setForm(emptyForm);
  };

  const saveAddress = async () => {
    const payload = {
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      address: form.address.trim(),
      isDefault: form.isDefault,
    };

    if (!payload.contactName || !payload.contactPhone || !payload.address) {
      Alert.alert('请补全信息', '联系人、联系电话和配送地址都需要填写');
      return;
    }

    setSavingAddress(true);
    try {
      if (editingAddress) {
        await updateBuyerAddress(editingAddress.id, payload);
      } else {
        await createBuyerAddress(payload);
      }
      closeModal();
      await loadAddresses();
    } catch (error: any) {
      Alert.alert('保存失败', error.message || '地址保存失败');
    } finally {
      setSavingAddress(false);
    }
  };

  const confirmDeleteAddress = (address: BuyerAddressDto) => {
    Alert.alert('删除地址', `确定删除 ${address.contactName} 的收货地址吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBuyerAddress(address.id);
            await loadAddresses();
          } catch (error: any) {
            Alert.alert('删除失败', error.message || '地址删除失败');
          }
        },
      },
    ]);
  };

  const makeDefaultAddress = async (address: BuyerAddressDto) => {
    try {
      await setDefaultBuyerAddress(address.id);
      await loadAddresses();
    } catch (error: any) {
      Alert.alert('设置失败', error.message || '无法设置默认地址');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{username}</Text>
          <Text style={styles.role}>{role}</Text>
        </View>

        {isBuyer && (
          <View style={styles.addressSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>收货地址</Text>
              <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
                <Text style={styles.addButtonText}>新增</Text>
              </TouchableOpacity>
            </View>

            {loadingAddresses ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#1a1a1a" />
                <Text style={styles.loadingText}>加载中</Text>
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>还没有收货地址</Text>
              </View>
            ) : (
              addresses.map((address) => (
                <View key={address.id} style={styles.addressCard}>
                  <View style={styles.addressTopRow}>
                    <Text style={styles.contactText}>
                      {address.contactName}  {address.contactPhone}
                    </Text>
                    {address.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>默认</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.addressText}>{address.address}</Text>
                  <View style={styles.actionsRow}>
                    {!address.isDefault && (
                      <TouchableOpacity style={styles.actionButton} onPress={() => makeDefaultAddress(address)}>
                        <Text style={styles.actionText}>设为默认</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(address)}>
                      <Text style={styles.actionText}>编辑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => confirmDeleteAddress(address)}>
                      <Text style={styles.deleteText}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

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
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>{editingAddress ? '编辑收货地址' : '新增收货地址'}</Text>

            <Text style={styles.fieldLabel}>联系人</Text>
            <TextInput
              style={styles.input}
              value={form.contactName}
              onChangeText={(text) => setForm((current) => ({ ...current, contactName: text }))}
              placeholder="例如：小王"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.fieldLabel}>联系电话</Text>
            <TextInput
              style={styles.input}
              value={form.contactPhone}
              onChangeText={(text) => setForm((current) => ({ ...current, contactPhone: text }))}
              placeholder="例如：18089333333"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>配送地址</Text>
            <TextInput
              style={[styles.input, styles.addressInput]}
              value={form.address}
              onChangeText={(text) => setForm((current) => ({ ...current, address: text }))}
              placeholder="例如：西安市钟楼"
              placeholderTextColor="#aaa"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>设为默认地址</Text>
              <Switch value={form.isDefault} onValueChange={(value) => setForm((current) => ({ ...current, isDefault: value }))} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveAddress} disabled={savingAddress}>
                <Text style={styles.saveText}>{savingAddress ? '保存中' : '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingBottom: 24 },
  header: { alignItems: 'center', padding: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: '#666', fontSize: 22, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  role: { fontSize: 12, color: '#999', marginTop: 3 },
  addressSection: { marginTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee', padding: 16, gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  addButton: { backgroundColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { color: '#666', fontSize: 13 },
  emptyBox: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 14, backgroundColor: '#fafafa' },
  emptyText: { color: '#888', fontSize: 13 },
  addressCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, gap: 8, backgroundColor: '#fff' },
  addressTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { flex: 1, color: '#1a1a1a', fontSize: 14, fontWeight: '700' },
  defaultBadge: { backgroundColor: '#edf7ee', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  defaultBadgeText: { color: '#2e7d32', fontSize: 11, fontWeight: '700' },
  addressText: { color: '#555', fontSize: 13, lineHeight: 19 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  actionButton: { paddingHorizontal: 8, paddingVertical: 5 },
  actionText: { color: '#333', fontSize: 13, fontWeight: '600' },
  deleteText: { color: '#c62828', fontSize: 13, fontWeight: '600' },
  menu: { marginTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuText: { fontSize: 14, color: '#333' },
  arrow: { color: '#ccc', fontSize: 16 },
  logoutBtn: { margin: 16, padding: 14, backgroundColor: '#fafafa', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  logoutText: { color: '#999', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 18 },
  modalPanel: { backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: '#555', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#1a1a1a', fontSize: 14, marginBottom: 12, backgroundColor: '#fff' },
  addressInput: { minHeight: 76 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  switchLabel: { color: '#333', fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalButton: { minWidth: 78, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  cancelButton: { backgroundColor: '#f4f4f4' },
  saveButton: { backgroundColor: '#1a1a1a' },
  cancelText: { color: '#555', fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' },
});
