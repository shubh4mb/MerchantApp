import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import api from '../utils/api';
import { Bell, Box, Truck, Info } from 'lucide-react-native';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/merchant/notifications');
      if (response.data && response.data.notifications) {
        setNotifications(response.data.notifications);
      } else if (response.data && Array.isArray(response.data)) {
        // Fallback for flattened response
        setNotifications(response.data);
      }
    } catch (error) {
      console.log('Error loading notifications', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async (id: string, read: boolean) => {
    if (!read) {
      try {
        await api.patch(`/merchant/notifications/${id}`);
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      } catch (error) {
        console.log('Error marking as read', error);
      }
    }
  };

  const getIcon = (type: string, read: boolean) => {
    const color = read ? "#94A3B8" : "#2563EB";
    switch (type) {
      case "new_order_placed":
        return <Box size={24} color={color} />;
      case "return_requested":
        return <Truck size={24} color={color} />;
      case "admin_notification":
      default:
        return <Info size={24} color={color} />;
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handlePress(item._id, item.read)}
    >
      <View style={styles.iconContainer}>
        {getIcon(item.type, item.read)}
      </View>
      <View style={styles.textContainer}>
        <View style={styles.headerContainer}>
          <Text style={[styles.title, !item.read && styles.unreadText]}>{item.title}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Notifications', headerTitle: 'Notifications' }} />
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notifications found.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  listContainer: {
    padding: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  unreadText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginTop: 4,
  },
  body: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  date: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 15,
  }
});
