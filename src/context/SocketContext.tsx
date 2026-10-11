import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { BACKEND_URL } from '../utils/api';
import {
  Alert,
  Vibration,
  Platform,
  AppState,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Bell, ShoppingBag, X, ArrowRight, Clock, AlertCircle } from 'lucide-react-native';
import api from '../utils/api';
import { playOrderAlert, stopOrderAlert } from '../utils/alertManager';

let Device: { isDevice: boolean } = { isDevice: Platform.OS !== 'web' };
try {
  Device = require('expo-device');
} catch (e) {
  console.warn('expo-device native module not available, using fallback');
}

// Configure notification behavior for when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { merchant } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  // Robust merchant ID extraction (supports id or _id)
  const merchantId = merchant?.id || (merchant as any)?._id;

  useEffect(() => {
    async function registerForPushNotifications() {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default Notifications',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });

          await Notifications.setNotificationChannelAsync('order_alerts', {
            name: 'Urgent Order Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 1000, 500, 1000],
            enableVibrate: true,
            sound: 'default',
            lightColor: '#EF4444',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
          });
        }

        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== 'granted') {
            console.log('Push notification permission not granted');
            return;
          }
          const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
          const token = (await Notifications.getExpoPushTokenAsync({
            projectId,
          })).data;
          
          console.log("Expo Push Token for Merchant:", token);
          await api.put('/merchant/push-token', { token });
          console.log("Merchant push token registered successfully on backend.");
        }
      } catch (err) {
        console.warn("Failed to register merchant push notifications:", err);
      }
    }

    if (merchantId) {
      registerForPushNotifications();
    }
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) {
      // Disconnect socket if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    console.log('🔌 Connecting to WebSocket at:', BACKEND_URL, 'for merchant:', merchantId);

    // Support both websocket and polling so mobile devices over LAN connect reliably
    const socketInstance = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      query: {
        merchantId: String(merchantId),
        role: 'merchant',
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 15000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('✅ Socket connected:', socketInstance.id);
      
      // Register merchant room on every connect/reconnect
      socketInstance.emit('registerMerchant', String(merchantId));
      
      // If merchant also has a warehouse attached, register warehouse room
      const whId = (merchant as any)?.warehouseId || (merchant as any)?.assignedWarehouse;
      if (whId) {
        console.log('✅ Also registering warehouse room:', whId);
        socketInstance.emit('registerWarehouse', String(whId));
      }
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('❌ Socket disconnected. Reason:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      setIsConnected(false);
      console.error('🔴 Socket connection error:', error.message);
    });

    socketInstance.io.on('reconnect_attempt', (attempt: number) => {
      console.log(`🔄 Reconnection attempt #${attempt}`);
    });

    socketInstance.io.on('reconnect', (attempt: number) => {
      console.log(`✅ Reconnected after ${attempt} attempt(s)`);
    });

    // Central handler for new orders (both standard & warehouse consigned orders)
    const handleIncomingOrder = async (rawPayload: any) => {
      console.log('📩 Incoming order socket payload received:', rawPayload);
      const order = rawPayload?.order || rawPayload;
      const orderId = order?._id || order?.orderId || order?.id;

      if (!orderId) {
        console.log('📩 Non-order payload received, ignoring:', rawPayload);
        return;
      }

      const normalizedOrder = {
        ...order,
        _id: String(orderId),
      };

      console.log('🔔 Showing New Order Modal & Sound for:', normalizedOrder._id);

      // Trigger prominent in-app pop-up modal
      setIncomingOrder(normalizedOrder);

      // Trigger looping sound & vibration
      try {
        await playOrderAlert();
      } catch (err) {
        console.warn('Audio alert error:', err);
      }

      // Trigger local OS notification banner
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'New Order Received! 🛍️',
            body: `Order #${String(orderId).slice(-6).toUpperCase()} has been placed. Prepare items.`,
            sound: true,
            priority: 'max',
            vibrate: [0, 500, 200, 500],
          },
          trigger: {
            channelId: 'order_alerts',
          } as any,
        });
      } catch (err) {
        console.error('Local notification sound trigger error:', err);
      }
    };

    socketInstance.on('newOrder', handleIncomingOrder);
    socketInstance.on('newWarehouseOrder', handleIncomingOrder);

    // Handle order cancelled notification
    socketInstance.on('orderCancelled', async (data: any) => {
      console.log('🛑 Order cancelled event received:', data);
      const shortId = data?.orderId ? String(data.orderId).slice(-6).toUpperCase() : '';
      const cancelReason = data?.reason || 'Cancelled upon request';

      // If currently alerting for this cancelled order, stop sound and dismiss popup
      if (incomingOrder?._id && String(incomingOrder._id) === String(data?.orderId || data?._id)) {
        stopOrderAlert();
        setIncomingOrder(null);
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Order Cancelled 🛑',
            body: `Order #${shortId} was cancelled (${cancelReason}).`,
            sound: true,
          },
          trigger: null,
        });
      } catch (err) {
        console.error('Local notification for cancelled order error:', err);
      }
    });

    const handleAppStateChange = (nextAppState: string) => {
      console.log('📱 AppState changed to:', nextAppState);
      if (nextAppState === 'active') {
        if (socketInstance && !socketInstance.connected) {
          console.log('🔌 Socket disconnected on foreground return. Connecting...');
          socketInstance.connect();
        } else if (socketInstance && socketInstance.connected) {
          socketInstance.emit('registerMerchant', String(merchantId));
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    return () => {
      appStateSubscription.remove();
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [merchantId]);

  const handleDismissModal = () => {
    stopOrderAlert();
    setIncomingOrder(null);
  };

  const handleViewOrder = () => {
    stopOrderAlert();
    setIncomingOrder(null);
    try {
      router.push('/(tabs)/orders');
    } catch (err) {
      console.warn('Navigation error:', err);
    }
  };

  // Compute order details for modal display
  const orderShortId = incomingOrder?._id ? String(incomingOrder._id).slice(-6).toUpperCase() : '';
  const orderItems: any[] = incomingOrder?.items || [];
  const orderAmount =
    incomingOrder?.billing?.finalAmount ??
    incomingOrder?.totalAmount ??
    incomingOrder?.finalAmount ??
    0;

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}

      {/* Prominent New Order Modal Alert */}
      <Modal
        visible={!!incomingOrder}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDismissModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header with animated-style alert banner */}
            <View style={styles.alertHeader}>
              <View style={styles.alertIconBadge}>
                <Bell size={24} color="#FFFFFF" />
              </View>
              <View style={styles.alertHeaderTexts}>
                <Text style={styles.alertTitle}>NEW ORDER RECEIVED!</Text>
                <Text style={styles.alertSub}>Order #{orderShortId}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleDismissModal}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Price & Status Highlight */}
            <View style={styles.summaryBar}>
              <View>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryAmount}>₹{orderAmount}</Text>
              </View>
              <View style={styles.orderTypeBadge}>
                <ShoppingBag size={14} color="#EF4444" />
                <Text style={styles.orderTypeText}>Instant Order</Text>
              </View>
            </View>

            {/* Items List Preview */}
            <View style={styles.itemsContainer}>
              <Text style={styles.itemsHeader}>Items ({orderItems.length})</Text>
              <ScrollView style={styles.itemsScroll} nestedScrollEnabled={true}>
                {orderItems.map((item, index) => (
                  <View key={item._id || index} style={styles.itemRow}>
                    <View style={styles.itemDot} />
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name || 'Product Item'}
                      </Text>
                      <Text style={styles.itemMeta}>
                        Qty: {item.quantity || 1} {item.size ? `• Size: ${item.size}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.itemPrice}>₹{item.price || 0}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Audio Indicator */}
            <View style={styles.soundIndicator}>
              <View style={styles.pulsingDot} />
              <Text style={styles.soundText}>Ringing Alert Active</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleViewOrder}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionText}>View & Accept Order</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismissModal}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissButtonText}>Dismiss Sound</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  alertHeaderTexts: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  alertSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  orderTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  itemsContainer: {
    marginBottom: 14,
  },
  itemsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  itemsScroll: {
    maxHeight: 140,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  itemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  soundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  soundText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  actionsContainer: {
    gap: 10,
  },
  primaryActionButton: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});

