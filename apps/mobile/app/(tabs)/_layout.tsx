import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#1a1a1a',
      tabBarInactiveTintColor: '#999',
      tabBarStyle: { borderTopColor: '#eee', backgroundColor: '#fff' },
      headerStyle: { backgroundColor: '#fafafa' },
      headerTitleStyle: { color: '#1a1a1a', fontWeight: '700' },
    }}>
      <Tabs.Screen name="index" options={{
        title: '首页', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
      }} />
      <Tabs.Screen name="orders" options={{
        title: '订单', tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
      }} />
      <Tabs.Screen name="prices" options={{
        title: '价格', tabBarIcon: ({ color, size }) => <Ionicons name="pricetag" size={size} color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: '我的', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
