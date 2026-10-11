import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Image,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import * as ImagePicker from 'expo-image-picker';
import {
  Clock,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  MapPin,
  RefreshCw,
  Camera,
  Trash2,
  X,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react-native';

// Try & Buy Order Interfaces
interface OrderItem {
  _id: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  image?: string;
  tryStatus?: 'pending' | 'accepted' | 'returned' | 'not-triable' | 'keep';
  status?: 'available' | 'out_of_stock' | 'cancelled';
  outOfStockReason?: string;
}

interface Billing {
  total: number;
  discount: number;
  finalAmount: number;
}

interface Order {
  _id: string;
  orderIdString: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'RETURNING';
  items: OrderItem[];
  billing: Billing;
  totalAmount?: number;
  actualPurchasedAmount?: number;
  finalBilling?: any;
  createdAt: string;
  address?: {
    street?: string;
    city?: string;
  };
  otp?: string | null;
  deliveryRiderDetails?: {
    name?: string;
    phone?: string;
  };
  riderUnresponsiveReport?: {
    status: 'pending' | 'resolved';
    reporter: 'customer' | 'merchant';
    timestamp: string;
  };
  cancellationRequest?: 'pending' | 'approved' | 'rejected' | null;
  cancellationRequestReason?: string;
  hasReportedIssue?: boolean;
  returnRequest?: any;
  reason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  hasUnavailableItems?: boolean;
  unavailableItemsCount?: number;
}

// Courier Order Interfaces
interface CourierOrderItem {
  productId: string;
  variantId: string;
  name: string;
  quantity: number;
  price: number;
  size: string;
  image?: string;
}

interface CourierOrder {
  _id: string;
  userId: string;
  items: CourierOrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  deliveryLocation: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  orderStatus: 'placed' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  returnRequest?: {
    status: 'none' | 'pending' | 'picked' | 'shipped' | 'received' | 'rejected';
    reason: string | null;
    faultType: 'merchant_fault' | 'customer_choice' | null;
    returnCharge: number;
    items: CourierOrderItem[];
    requestedAt?: string;
    processedAt?: string;
    images?: string[];
  };
}

const COURIER_STATUS_FLOW = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

export default function OrdersScreen() {
  const { socket } = useSocket();
  
  // Segmented tab state
  const [orderType, setOrderType] = useState<'instant' | 'courier'>('instant');

  // Instant order states
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeInstantTab, setActiveInstantTab] = useState<'pending' | 'preparing' | 'history'>('pending');
  const initialTabSelected = useRef(false);

  // Courier order states
  const [courierOrders, setCourierOrders] = useState<CourierOrder[]>([]);
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [updatingCourierId, setUpdatingCourierId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Expand / Collapse state per order
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Reason Modal State
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [reasonModalType, setReasonModalType] = useState<'reject' | 'cancel' | null>(null);
  const [reasonModalOrderId, setReasonModalOrderId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Packing proof states
  const [packingOrderId, setPackingOrderId] = useState<string | null>(null);
  const [showPackingModal, setShowPackingModal] = useState<boolean>(false);
  const [packingPhotos, setPackingPhotos] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Damage reporting states
  const [showDamageModal, setShowDamageModal] = useState<boolean>(false);
  const [damageOrder, setDamageOrder] = useState<any>(null);
  const [selectedDamageItemId, setSelectedDamageItemId] = useState<string>('');
  const [damageCategory, setDamageCategory] = useState<string>('fabric_tear');
  const [damageDescription, setDamageDescription] = useState<string>('');
  const [damagePhotos, setDamagePhotos] = useState<Array<{ uri: string }>>([]);
  const [isSubmittingDamage, setIsSubmittingDamage] = useState<boolean>(false);

  const mapBackendStatus = (backendStatus: string): string => {
    switch (backendStatus) {
      case 'placed':
        return 'PENDING';
      case 'accepted':
        return 'ACCEPTED';
      case 'packed':
        return 'PACKED';
      case 'in_transit':
      case 'try_phase':
      case 'selection_made':
        return 'OUT_FOR_DELIVERY';
      case 'return_in_progress':
        return 'RETURNING';
      case 'completed':
      case 'delivered':
        return 'DELIVERED';
      case 'cancelled':
        return 'CANCELLED';
      case 'rejected':
        return 'REJECTED';
      default:
        return (backendStatus || '').toUpperCase();
    }
  };

  const mapOrderFields = (order: any): Order => {
    let rawStatus = order.orderStatus || order.status;
    if (
      order.customerDeliveryStatus === 'cancelled' ||
      order.cancelledBy ||
      (order.reason && order.deliveryRiderStatus === 'cancelled')
    ) {
      rawStatus = 'cancelled';
    }
    const status = mapBackendStatus(rawStatus);
    const isPostDecision = ['DELIVERED', 'RETURNING', 'selection_made', 'completed', 'delivered', 'return_in_progress'].includes(status);

    const acceptedItems = (order.items || []).filter((item: any) =>
      item.tryStatus === 'accepted' || item.tryStatus === 'keep' || item.tryStatus === 'not-triable'
    );
    const acceptedSubtotal = acceptedItems.reduce((acc: number, i: any) => acc + ((i.price || 0) * (i.quantity || 1)), 0);

    const actualPurchased = order.actualPurchasedAmount !== undefined && order.actualPurchasedAmount !== null
      ? order.actualPurchasedAmount
      : (order.finalBilling?.baseAmount !== undefined && order.finalBilling?.baseAmount !== null
          ? order.finalBilling.baseAmount
          : (isPostDecision ? acceptedSubtotal : (order.totalAmount || acceptedSubtotal)));

    const billing: Billing = {
      total: order.totalAmount || acceptedSubtotal,
      discount: order.finalBilling?.discount || 0,
      finalAmount: isPostDecision ? actualPurchased : (order.totalAmount || acceptedSubtotal),
    };
    return {
      ...order,
      actualPurchasedAmount: actualPurchased,
      status: status as any,
      billing,
    };
  };

  const fetchInstantOrders = async () => {
    try {
      const response = await api.get('/merchant/getAllOrders');
      const orderList = Array.isArray(response.data)
        ? response.data
        : response.data.orders || [];
      const mapped = orderList.map(mapOrderFields);
      setOrders(mapped);

      // Smart default tab selection on initial load
      if (!initialTabSelected.current) {
        initialTabSelected.current = true;
        const pending = mapped.filter((o: Order) => o.status === 'PENDING').length;
        const active = mapped.filter((o: Order) =>
          ['ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'RETURNING'].includes(o.status)
        ).length;
        if (pending === 0 && active > 0) {
          setActiveInstantTab('preparing');
        }
      }
    } catch (error) {
      console.error('Failed to load instant orders:', error);
    }
  };

  const fetchCourierOrders = async () => {
    try {
      const response = await api.get('/merchant/courier/getAllOrders');
      setCourierOrders(response.data?.orders || response.data || []);
    } catch (error) {
      console.error('Failed to load courier orders:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    if (orderType === 'instant') {
      await fetchInstantOrders();
    } else {
      await fetchCourierOrders();
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAllData();
  }, [orderType]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (orderType === 'instant') {
      fetchInstantOrders().finally(() => setRefreshing(false));
    } else {
      fetchCourierOrders().finally(() => setRefreshing(false));
    }
  };

  // Socket updates for Instant orders
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (rawPayload: any) => {
      const newOrder = rawPayload?.order || rawPayload;
      const orderId = newOrder?._id || newOrder?.orderId || newOrder?.id;
      if (!orderId) return;

      const normalized = {
        ...newOrder,
        _id: String(orderId),
      };

      // Always add to instant orders list (avoid duplicates) and switch to pending tab
      setOrders((prev) => {
        if (prev.some((o) => o._id === normalized._id)) return prev;
        return [mapOrderFields(normalized), ...prev];
      });
      setOrderType('instant');
      setActiveInstantTab('pending');
    };

    const handleOrderUpdate = (updatedOrder: any) => {
      const order = updatedOrder?.order || updatedOrder;
      const orderId = order?._id || order?.orderId || order?.id;
      if (!orderId) return;
      const normalized = { ...order, _id: String(orderId) };

      setOrders((prev) =>
        prev.map((o) => (o._id === normalized._id ? mapOrderFields({ ...o, ...normalized }) : o))
      );
      if (packingOrderId === normalized._id && (normalized.orderStatus === 'cancelled' || normalized.status === 'CANCELLED')) {
        Alert.alert('Order Cancelled', `Order #${String(normalized._id).slice(-5).toUpperCase()} was cancelled by the customer.`);
        setShowPackingModal(false);
        setPackingOrderId(null);
      }
    };

    const handleOrderCancelled = (cancelledData: any) => {
      const orderId = cancelledData?.orderId || cancelledData?._id;
      if (!orderId) return;

      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId
            ? mapOrderFields({
                ...o,
                ...(cancelledData.order || {}),
                orderStatus: 'cancelled',
                status: 'CANCELLED',
                customerDeliveryStatus: 'cancelled',
                reason: cancelledData.reason || o.reason,
                cancelledBy: cancelledData.cancelledBy || o.cancelledBy || 'user',
                cancelledAt: cancelledData.cancelledAt || new Date().toISOString(),
                hasUnavailableItems: cancelledData.hasUnavailableItems ?? o.hasUnavailableItems,
                items: cancelledData.order?.items || o.items,
              })
            : o
        )
      );

      const cancelReason = cancelledData.reason ? `: ${cancelledData.reason}` : '';
      Alert.alert(
        'Order Cancelled',
        `Order #${String(orderId).slice(-5).toUpperCase()} was cancelled by the customer${cancelReason}.`
      );

      if (String(packingOrderId) === String(orderId)) {
        setShowPackingModal(false);
        setPackingOrderId(null);
      }
      fetchInstantOrders();
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('newWarehouseOrder', handleNewOrder);
    socket.on('orderUpdate', handleOrderUpdate);
    socket.on('warehouseOrderUpdate', handleOrderUpdate);
    socket.on('orderCancelled', handleOrderCancelled);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('newWarehouseOrder', handleNewOrder);
      socket.off('orderUpdate', handleOrderUpdate);
      socket.off('warehouseOrderUpdate', handleOrderUpdate);
      socket.off('orderCancelled', handleOrderCancelled);
    };
  }, [socket, orderType, packingOrderId]);

  // Instant order status actions
  const handleAcceptOrder = async (orderId: string) => {
    try {
      await api.put(`/merchant/orderRequestForMerchant/${orderId}`, {
        status: 'accept',
        reason: '',
      });
      Alert.alert('Success', 'Order accepted successfully. Start preparing.');
      // Auto-switch to Active tab and expand this order
      setActiveInstantTab('preparing');
      setExpandedOrders((prev) => ({
        ...prev,
        [orderId]: true,
      }));
      fetchInstantOrders();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to accept order.');
    }
  };

  const handleSubmitReason = async () => {
    if (!reasonText || reasonText.trim() === '') {
      Alert.alert('Required', 'A reason is required.');
      return;
    }
    
    if (!reasonModalOrderId) return;
    
    const orderId = reasonModalOrderId;
    setReasonModalVisible(false);
    
    try {
      if (reasonModalType === 'reject') {
        await api.put(`/merchant/orderRequestForMerchant/${orderId}`, {
          status: 'reject',
          reason: reasonText,
        });
        Alert.alert('Order Rejected', 'Cancellation response transmitted.');
      } else if (reasonModalType === 'cancel') {
        await api.put(`/merchant/order/${orderId}/request-cancellation`, { reason: reasonText });
        Alert.alert('Success', 'Cancellation request submitted to admin.');
      }
      fetchInstantOrders();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit request.');
    }
  };

  const handleRejectOrder = (orderId: string) => {
    setReasonModalType('reject');
    setReasonModalOrderId(orderId);
    setReasonText('');
    setReasonModalVisible(true);
  };

  const handleHelp = (orderId: string, order: Order) => {
    if (order.riderUnresponsiveReport?.status === 'pending') {
      Alert.alert('Already Reported', 'You have already reported the rider. An admin is reviewing it.');
      return;
    }
    Alert.alert(
      "Help Support",
      "How can we assist you with this order?",
      [
        { text: "Rider is unresponsive", onPress: () => handleReportRider(orderId, order) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleReportRider = (orderId: string, order: Order) => {
    Alert.alert(
      "Report Rider Unresponsive",
      "Are you sure you want to report the rider? An admin will review this and may cancel the order if the rider cannot be reached.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Report", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.post(`/merchant/order/report-rider/${orderId}`);
              Alert.alert('Success', 'Rider reported successfully. Admin will review.');
              fetchInstantOrders();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to report rider.');
            }
          }
        }
      ]
    );
  };

  const handleRequestCancellation = (orderId: string, order: Order) => {
    if (order.cancellationRequest === 'pending') {
      Alert.alert('Already Requested', 'You have already requested cancellation for this order. An admin is reviewing it.');
      return;
    }
    
    setReasonModalType('cancel');
    setReasonModalOrderId(orderId);
    setReasonText('');
    setReasonModalVisible(true);
  };

  const handleStartPacking = async (orderId: string) => {
    setPackingOrderId(orderId);
    setShowPackingModal(true);
    setPackingPhotos([]);
    setModalLoading(true);
    try {
      const res = await api.get(`/merchant/order/${orderId}/packing-photos`);
      setPackingPhotos(res.data?.packingPhotos || (res.data as any) || []);
    } catch (err) {
      console.error("Failed to load initial packing photos", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleTakePhoto = async (itemId: string) => {
    if (!packingOrderId) return;
    
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraPermission.granted || !galleryPermission.granted) {
      Alert.alert('Permission Denied', 'Camera and Gallery access are required to upload proof photos.');
      return;
    }

    Alert.alert(
      'Upload Packing Photo',
      'Choose photo source for packing verification:',
      [
        {
          text: 'Snap with Camera',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              uploadPhotoUri(itemId, result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              uploadPhotoUri(itemId, result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadPhotoUri = async (itemId: string, uri: string) => {
    if (!packingOrderId) return;
    try {
      const filename = uri.split('/').pop() || `packing_photo.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const formData = new FormData();
      formData.append('image', {
        uri,
        name: filename,
        type,
      } as any);
      formData.append('orderId', packingOrderId);
      formData.append('itemId', itemId);

      setModalLoading(true);
      await api.post('/merchant/order/packing-photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const photosRes = await api.get(`/merchant/order/${packingOrderId}/packing-photos`);
      setPackingPhotos(photosRes.data?.packingPhotos || (photosRes.data as any) || []);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to upload photo.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!packingOrderId) return;
    
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setModalLoading(true);
            try {
              await api.delete(`/merchant/order/${packingOrderId}/packing-photos/${photoId}`);
              const photosRes = await api.get(`/merchant/order/${packingOrderId}/packing-photos`);
              setPackingPhotos(photosRes.data?.packingPhotos || (photosRes.data as any) || []);
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete photo.');
            } finally {
              setModalLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleMarkOutOfStock = (orderId: string, itemId: string, itemName: string) => {
    Alert.alert(
      'Mark as Out of Stock?',
      `Are you sure "${itemName}" is missing or out of stock? It will be removed from this order. The customer will be notified and given the option to cancel.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Out of Stock',
          style: 'destructive',
          onPress: async () => {
            try {
              setModalLoading(true);
              const res = await api.post(`/merchant/order/${orderId}/item-out-of-stock`, {
                itemId,
                reason: 'Item unavailable at boutique',
              });

              if (res.data?.allItemsOutOfStock) {
                Alert.alert(
                  'Order Cancelled',
                  'All items in this order are out of stock. The order has been automatically cancelled.'
                );
                setShowPackingModal(false);
                setPackingOrderId(null);
                fetchInstantOrders();
              } else {
                Alert.alert('Updated', `"${itemName}" marked out of stock. Order updated with remaining items.`);
                setOrders((prev) =>
                  prev.map((o) =>
                    o._id === orderId
                      ? {
                          ...o,
                          items: (o.items || []).map((it: any) =>
                            it._id === itemId ? { ...it, status: 'out_of_stock' } : it
                          ),
                          totalAmount: res.data?.order?.totalAmount ?? o.totalAmount,
                        }
                      : o
                  )
                );
                fetchInstantOrders();
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to mark item out of stock.');
            } finally {
              setModalLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkPacked = async (orderId: string) => {
    try {
      const packingOrder = orders.find(o => o._id === orderId);
      const availableItems = (packingOrder?.items || []).filter((i: any) => i.status !== 'out_of_stock');
      if (availableItems.length === 0) {
        Alert.alert('Cannot Pack', 'All items in this order are out of stock.');
        return;
      }

      await api.post(`/merchant/order/packed/${orderId}`);
      Alert.alert('Packed', 'Order is ready for delivery rider pickup.');
      setShowPackingModal(false);
      setPackingOrderId(null);
      fetchInstantOrders();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to update packaging status.';
      Alert.alert('Cannot Pack', errorMsg);
      if (errorMsg.toLowerCase().includes('cancel')) {
        setShowPackingModal(false);
        setPackingOrderId(null);
        fetchInstantOrders();
      }
    }
  };

  const handleOpenDamageReport = (order: any) => {
    setDamageOrder(order);
    const returnedProd = order.products?.find((p: any) => p.tryStatus === 'returned');
    setSelectedDamageItemId(returnedProd?._id || order.products?.[0]?._id || '');
    setDamageCategory('fabric_tear');
    setDamageDescription('');
    setDamagePhotos([]);
    setShowDamageModal(true);
  };

  const handlePickDamagePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        setDamagePhotos((prev) => [
          ...prev,
          ...result.assets.map((asset) => ({ uri: asset.uri })),
        ]);
      }
    } catch (err) {
      console.error('Pick photo error:', err);
    }
  };

  const handleTakeDamagePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setDamagePhotos((prev) => [...prev, { uri: result.assets[0].uri }]);
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const handleSubmitDamageReport = async () => {
    if (!damageDescription.trim()) {
      Alert.alert('Description Required', 'Please provide a brief explanation of what is damaged or missing.');
      return;
    }

    if (damagePhotos.length === 0) {
      Alert.alert('Photos Required', 'Please upload at least 1 photo showing the damage or issue.');
      return;
    }

    setIsSubmittingDamage(true);
    try {
      const formData = new FormData();
      formData.append('orderId', damageOrder._id);
      if (selectedDamageItemId) {
        formData.append('itemId', selectedDamageItemId);
      }
      formData.append('issueType', 'damage');
      formData.append('damageCategory', damageCategory);
      formData.append('description', damageDescription);

      damagePhotos.forEach((photo, idx) => {
        const filename = photo.uri.split('/').pop() || `damage_${idx}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        formData.append('images', {
          uri: photo.uri,
          name: filename,
          type,
        } as any);
      });

      await api.post('/merchant/return-issues', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('✓ Report Submitted', 'Dispute ticket raised. Admin will review the photos and timeline.');
      setShowDamageModal(false);
      fetchInstantOrders();
    } catch (err: any) {
      console.error('Submit damage issue error:', err);
      Alert.alert('Submission Failed', err.response?.data?.message || 'Could not submit return report.');
    } finally {
      setIsSubmittingDamage(false);
    }
  };

  // Courier order status actions
  const getNextCourierStatus = (currentStatus: string): string | null => {
    const idx = COURIER_STATUS_FLOW.indexOf(currentStatus);
    if (idx === -1 || idx >= COURIER_STATUS_FLOW.length - 1) return null;
    return COURIER_STATUS_FLOW[idx + 1];
  };

  const handleCourierStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingCourierId(orderId);
    try {
      await api.patch(`/merchant/courier/order/${orderId}/status`, { status: newStatus });
      setCourierOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, orderStatus: newStatus as any } : o))
      );
      Alert.alert('Updated', `Courier order status advanced to ${newStatus.toUpperCase()}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update courier status.');
    } finally {
      setUpdatingCourierId(null);
    }
  };

  const handleCourierReturnStatusUpdate = async (
    orderId: string,
    newStatus: 'picked' | 'shipped' | 'received' | 'rejected',
    rejectReason?: string
  ) => {
    setUpdatingCourierId(orderId);
    try {
      await api.patch(`/merchant/courier/order/${orderId}/return/status`, {
        status: newStatus,
        rejectReason,
      });
      Alert.alert('Updated', `Return status updated to ${newStatus.toUpperCase()}`);
      fetchCourierOrders();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update return status.');
    } finally {
      setUpdatingCourierId(null);
    }
  };

  // Counts
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const activeCount = orders.filter((o) =>
    ['ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'RETURNING'].includes(o.status)
  ).length;
  const historyCount = orders.filter((o) =>
    ['REJECTED', 'DELIVERED', 'CANCELLED'].includes(o.status)
  ).length;

  const getCourierCount = (filterStatus: string) => {
    if (filterStatus === 'all') return courierOrders.length;
    return courierOrders.filter((o) => o.orderStatus === filterStatus).length;
  };

  // Filtering Lists
  const getFilteredInstantOrders = () => {
    return orders.filter((order) => {
      if (activeInstantTab === 'pending') return order.status === 'PENDING';
      if (activeInstantTab === 'preparing') {
        return ['ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'RETURNING'].includes(order.status);
      }
      return ['REJECTED', 'DELIVERED', 'CANCELLED'].includes(order.status);
    });
  };

  const getFilteredCourierOrders = () => {
    if (courierFilter === 'all') return courierOrders;
    return courierOrders.filter((o) => o.orderStatus === courierFilter);
  };

  // Helpers
  const getInstantStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#F59E0B';
      case 'ACCEPTED': return '#3B82F6';
      case 'PACKED': return '#8B5CF6';
      case 'OUT_FOR_DELIVERY': return '#06B6D4';
      case 'RETURNING': return '#F97316';
      case 'DELIVERED': return '#10B981';
      case 'REJECTED':
      case 'CANCELLED': return '#EF4444';
      default: return '#64748B';
    }
  };

  const getCourierStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return '#10B981';
      case 'shipped': return '#06B6D4';
      case 'packed': return '#8B5CF6';
      case 'confirmed': return '#3B82F6';
      case 'placed': return '#F59E0B';
      case 'cancelled': return '#EF4444';
      default: return '#64748B';
    }
  };

  // Rendering individual Instant card
  const renderInstantCard = ({ item }: { item: Order }) => {
    const isPending = item.status === 'PENDING';
    const isPreparing = item.status === 'ACCEPTED';
    const formattedId = item._id.substring(item._id.length - 6).toUpperCase();
    const isExpanded = !!expandedOrders[item._id];
    const totalItemsCount = item.items?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 0;

    const isPostDecision = ['DELIVERED', 'RETURNING'].includes(item.status);
    const acceptedItems = (item.items || []).filter(
      (i) => i.tryStatus === 'accepted' || i.tryStatus === 'keep' || i.tryStatus === 'not-triable'
    );
    const acceptedCount = acceptedItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
    const hasReturns = (item.items || []).some((i) => i.tryStatus === 'returned');
    const displayAmount = isPostDecision 
      ? (item.billing?.finalAmount ?? item.actualPurchasedAmount ?? 0)
      : (item.billing?.total ?? item.totalAmount ?? 0);

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleExpand(item._id)}
          style={styles.cardHeaderTouchable}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.orderId}>Instant #{formattedId}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getInstantStatusColor(item.status) + '15' }]}>
                  <Text style={[styles.statusText, { color: getInstantStatusColor(item.status) }]}>
                    {item.status === 'CANCELLED' && item.cancelledBy === 'user' ? 'CANCELLED (CUSTOMER)' : item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {'  •  '}{isPostDecision && hasReturns ? `${acceptedCount} bought (${totalItemsCount} tried)` : `${totalItemsCount} ${totalItemsCount === 1 ? 'item' : 'items'}`}
                {'  •  '}₹{displayAmount}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {['PACKED', 'OUT_FOR_DELIVERY'].includes(item.status) && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleHelp(item._id, item); }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#3B82F6' }}>Help</Text>
                </TouchableOpacity>
              )}
              <View style={styles.expandChevronContainer}>
                {isExpanded ? (
                  <ChevronUp size={20} color="#64748B" />
                ) : (
                  <ChevronDown size={20} color="#64748B" />
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Cancellation Notice Banner */}
        {item.status === 'CANCELLED' && (
          <View style={styles.cancelledBanner}>
            <View style={styles.cancelledBannerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <AlertCircle size={15} color="#DC2626" />
                <Text style={styles.cancelledBannerTitle}>
                  {item.cancelledBy === 'user'
                    ? 'Cancelled by Customer'
                    : item.cancelledBy === 'merchant'
                      ? 'Cancelled by Store'
                      : item.cancelledBy === 'admin'
                        ? 'Cancelled by Support'
                        : 'Order Cancelled'}
                </Text>
              </View>
              {(item.hasUnavailableItems || (item.items || []).some((i: any) => i.status === 'out_of_stock')) && (
                <View style={styles.oosTag}>
                  <Text style={styles.oosTagText}>Item Out of Stock</Text>
                </View>
              )}
            </View>
            <Text style={styles.cancelledReasonText}>
              Reason: {item.reason || (item.hasUnavailableItems ? 'Cancelled by customer due to out-of-stock item' : 'Order cancelled upon request')}
            </Text>
            {(item.hasUnavailableItems || (item.items || []).some((i: any) => i.status === 'out_of_stock')) && (
              <Text style={styles.cancelledOosExpl}>
                Customer chose to cancel the entire order after an item was marked out of stock.
              </Text>
            )}
            {item.cancelledAt && (
              <Text style={styles.cancelledDateText}>
                Cancelled on {new Date(item.cancelledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        )}

        {isExpanded && (
          <View style={{ marginTop: 8 }}>
            <View style={styles.divider} />

            <View style={styles.itemsSection}>
              {item.items.map((prod, idx) => {
                const isOos = prod.status === 'out_of_stock';
                const isOrderCancelled = item.status === 'CANCELLED';

                return (
                  <View key={prod._id || idx} style={[styles.itemRow, isOos && styles.itemRowOos]}>
                    {prod.image ? (
                      <Image
                        source={{ uri: prod.image }}
                        style={[styles.itemImage, isOos && { opacity: 0.5 }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Package size={18} color="#94A3B8" />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, isOos && styles.itemNameOos]} numberOfLines={1}>
                        {prod.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                        <Text style={styles.itemMeta}>
                          {prod.size ? `Size: ${prod.size}  •  ` : ''}Qty: {prod.quantity}
                        </Text>
                        {isOos && (
                          <View style={styles.itemOosBadge}>
                            <Text style={styles.itemOosBadgeText}>OUT OF STOCK</Text>
                          </View>
                        )}
                        {isOrderCancelled && !isOos && (
                          <View style={styles.itemCancelledBadge}>
                            <Text style={styles.itemCancelledBadgeText}>CANCELLED</Text>
                          </View>
                        )}
                        {isPostDecision && prod.tryStatus && !isOos && (
                          <Text style={{ color: prod.tryStatus === 'returned' ? '#EF4444' : '#10B981', fontWeight: '600' }}>
                            {'  '}•  {prod.tryStatus === 'returned' ? 'RETURNED' : 'BOUGHT / KEPT'}
                          </Text>
                        )}
                      </View>
                      {isOos && prod.outOfStockReason && (
                        <Text style={styles.itemOosReasonText}>
                          Reason: {prod.outOfStockReason}
                        </Text>
                      )}
                    </View>
                    <Text style={[
                      styles.itemPrice,
                      (prod.tryStatus === 'returned' || isOos) && { textDecorationLine: 'line-through', color: '#94A3B8' }
                    ]}>
                      ₹{prod.price * prod.quantity}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.divider} />

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.amountLabel}>
                  {isPostDecision ? 'Purchased Amount:' : 'Total Amount:'}
                </Text>
                {isPostDecision && hasReturns && (
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Initial Try Order: ₹{item.billing?.total || item.totalAmount || 0}
                  </Text>
                )}
              </View>
              <Text style={styles.amountVal}>₹{displayAmount}</Text>
            </View>

            {item.otp && (
              <View style={[styles.otpContainer, item.status === 'RETURNING' && { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                <Text style={[styles.otpLabel, item.status === 'RETURNING' && { color: '#C2410C' }]}>
                  {item.status === 'RETURNING' ? 'Return Verification OTP: ' : 'Delivery Verification OTP: '}
                </Text>
                <Text style={[styles.otpValue, item.status === 'RETURNING' && { color: '#C2410C' }]}>{item.otp}</Text>
              </View>
            )}

            {item.deliveryRiderDetails && (
              <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>Assigned Rider</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                    {item.deliveryRiderDetails.name || 'Rider'}
                  </Text>
                  {item.deliveryRiderDetails.phone && (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.deliveryRiderDetails?.phone}`)}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#3B82F6' }}>
                        {item.deliveryRiderDetails.phone}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {isPending && (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleRejectOrder(item._id)}>
                  <ShieldAlert size={16} color="#EF4444" style={styles.btnIcon} />
                  <Text style={styles.rejectBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleAcceptOrder(item._id)}>
                  <CheckCircle2 size={16} color="#FFFFFF" style={styles.btnIcon} />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
              </View>
            )}

            {isPreparing && (
              <TouchableOpacity style={styles.packBtn} onPress={() => handleStartPacking(item._id)}>
                <Text style={styles.packBtnText}>Mark as Packed</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {!isPending && !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(item.status) && (
              <View style={{ marginTop: 12 }}>
                {item.cancellationRequest === 'pending' ? (
                  <View style={{ backgroundColor: '#FFFBEB', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FEF3C7', flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#D97706', fontSize: 13, fontWeight: '600', flex: 1 }}>Cancellation Requested (Admin Reviewing)</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FEE2E2', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => handleRequestCancellation(item._id, item)}
                  >
                    <Trash2 size={16} color="#EF4444" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>Request Cancellation</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Report Return Damage / Issue Button */}
            {(item.status === 'RETURNING' || item.status === 'DELIVERED') && (
              <View style={{ marginTop: 12 }}>
                {item.hasReportedIssue ? (
                  <View style={{ backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldAlert size={16} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#B45309', fontSize: 13, fontWeight: '700' }}>Damage Dispute Under Review</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={{ backgroundColor: '#FFF1F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECDD3', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => handleOpenDamageReport(item)}
                  >
                    <ShieldAlert size={16} color="#E11D48" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#E11D48', fontSize: 14, fontWeight: '700' }}>Report Damaged / Missing Item</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Rendering individual Courier card
  const renderCourierCard = ({ item }: { item: CourierOrder }) => {
    const formattedId = item._id.substring(item._id.length - 8).toUpperCase();
    const nextStatus = getNextCourierStatus(item.orderStatus);
    const isUpdating = updatingCourierId === item._id;
    const isExpanded = !!expandedOrders[item._id];
    const totalItemsCount = item.items?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 0;
    const totalAmount = item.totalAmount + item.deliveryCharge;

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleExpand(item._id)}
          style={styles.cardHeaderTouchable}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.orderId}>Courier #{formattedId}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getCourierStatusColor(item.orderStatus) + '15' }]}>
                  <Text style={[styles.statusText, { color: getCourierStatusColor(item.orderStatus) }]}>
                    {item.orderStatus}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                {'  •  '}{totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                {'  •  '}₹{totalAmount}
              </Text>
            </View>

            <View style={styles.expandChevronContainer}>
              {isExpanded ? (
                <ChevronUp size={20} color="#64748B" />
              ) : (
                <ChevronDown size={20} color="#64748B" />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={{ marginTop: 8 }}>
            <View style={styles.divider} />

            {/* Courier Items */}
            <View style={styles.itemsSection}>
              {item.items.map((prod, idx) => (
                <View key={idx} style={styles.itemRow}>
                  {prod.image ? (
                    <Image
                      source={{ uri: prod.image }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Package size={18} color="#94A3B8" />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {prod.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {prod.size ? `Size: ${prod.size}  •  ` : ''}Qty: {prod.quantity}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{prod.price * prod.quantity}</Text>
                </View>
              ))}
            </View>

            {/* Shipping address details */}
            <View style={styles.addressBox}>
              <View style={styles.addressTitleRow}>
                <MapPin size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.addressTitle}>Shipping Address</Text>
              </View>
              <Text style={styles.addressText}>
                {item.deliveryLocation?.name} • {item.deliveryLocation?.phone}
              </Text>
              <Text style={styles.addressSubtext}>
                {item.deliveryLocation?.addressLine1}, {item.deliveryLocation?.city}, {item.deliveryLocation?.state} - {item.deliveryLocation?.pincode}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.amountLabel}>Total (inc. delivery):</Text>
                <Text style={styles.courierChargeText}>Delivery charge: ₹{item.deliveryCharge}</Text>
              </View>
              <Text style={styles.amountVal}>₹{totalAmount}</Text>
            </View>

            {/* Return request section */}
            {item.returnRequest && item.returnRequest.status !== 'none' && (
              <View style={[
                styles.merchantReturnSection,
                item.returnRequest.status === 'pending' ? { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' } :
                item.returnRequest.status === 'rejected' ? { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' } :
                item.returnRequest.status === 'received' ? { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' } :
                { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }
              ]}>
                <View style={styles.returnSectionHeader}>
                  <RefreshCw size={14} color="#0F172A" />
                  <Text style={styles.returnSectionTitle}>
                    Return Request: {item.returnRequest.status.toUpperCase()}
                  </Text>
                </View>
                
                <Text style={styles.returnSectionInfo}>
                  <Text style={{ fontWeight: '700' }}>Reason: </Text>
                  {item.returnRequest.reason}
                </Text>
                <Text style={styles.returnSectionInfo}>
                  <Text style={{ fontWeight: '700' }}>Liability: </Text>
                  {item.returnRequest.faultType === 'merchant_fault' ? 'Merchant Fault' : 'Customer Choice'}
                </Text>
                <Text style={styles.returnSectionInfo}>
                  <Text style={{ fontWeight: '700' }}>Return Charge: </Text>
                  ₹{item.returnRequest.returnCharge} ({item.returnRequest.faultType === 'merchant_fault' ? 'Debited from you' : 'Deducted from customer refund'})
                </Text>

                {/* Return Items */}
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }}>
                  <Text style={styles.returnSectionSub}>Items to Return:</Text>
                  {item.returnRequest.items.map((rItem, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      {rItem.image ? (
                        <Image source={{ uri: rItem.image }} style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }} resizeMode="cover" />
                      ) : (
                        <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#E2E8F0', marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={14} color="#64748B" />
                        </View>
                      )}
                      <Text style={styles.returnItemText}>
                        {rItem.name} ({rItem.size}) x{rItem.quantity} - ₹{rItem.price * rItem.quantity}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Return Images */}
                {item.returnRequest.images && item.returnRequest.images.length > 0 && (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }}>
                    <Text style={styles.returnSectionSub}>Evidence Photos:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                      {item.returnRequest.images.map((imgUrl, imgIdx) => (
                        <TouchableOpacity key={imgIdx} onPress={() => Linking.openURL(imgUrl)}>
                          <Image
                            source={{ uri: imgUrl }}
                            style={{
                              width: 60,
                              height: 60,
                              borderRadius: 8,
                              marginRight: 8,
                              backgroundColor: '#F1F5F9',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                            }}
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.returnActionsRow}>
                  {item.returnRequest.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.returnActionBtn, { backgroundColor: '#3B82F6', marginRight: 8 }]}
                        onPress={() => handleCourierReturnStatusUpdate(item._id, 'picked')}
                        disabled={isUpdating}
                      >
                        <Text style={styles.returnActionBtnText}>Mark Picked</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.returnActionBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => {
                          Alert.alert(
                            'Reject Return',
                            'Are you sure you want to reject this return request?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Reject',
                                style: 'destructive',
                                onPress: () => handleCourierReturnStatusUpdate(item._id, 'rejected', 'Items do not match return policy')
                              }
                            ]
                          );
                        }}
                        disabled={isUpdating}
                      >
                        <Text style={styles.returnActionBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {item.returnRequest.status === 'picked' && (
                    <TouchableOpacity
                      style={[styles.returnActionBtn, { backgroundColor: '#8B5CF6', flex: 1 }]}
                      onPress={() => handleCourierReturnStatusUpdate(item._id, 'shipped')}
                      disabled={isUpdating}
                    >
                      <Text style={styles.returnActionBtnText}>Mark Shipped</Text>
                    </TouchableOpacity>
                  )}

                  {item.returnRequest.status === 'shipped' && (
                    <TouchableOpacity
                      style={[styles.returnActionBtn, { backgroundColor: '#10B981', flex: 1 }]}
                      onPress={() => handleCourierReturnStatusUpdate(item._id, 'received')}
                      disabled={isUpdating}
                    >
                      <Text style={styles.returnActionBtnText}>Confirm Received & Refund</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {nextStatus && item.orderStatus !== 'cancelled' && (!item.returnRequest || item.returnRequest.status === 'none') && (
              <TouchableOpacity
                style={styles.packBtn}
                onPress={() => handleCourierStatusUpdate(item._id, nextStatus)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.packBtnText}>Mark as {nextStatus.toUpperCase()}</Text>
                    <Truck size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Segment Selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeBtn, orderType === 'instant' && styles.typeBtnActive]}
          onPress={() => setOrderType('instant')}
        >
          <Text style={[styles.typeBtnText, orderType === 'instant' && styles.typeBtnTextActive]}>
            Instant (Try & Buy)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, orderType === 'courier' && styles.typeBtnActive]}
          onPress={() => setOrderType('courier')}
        >
          <Text style={[styles.typeBtnText, orderType === 'courier' && styles.typeBtnTextActive]}>
            Courier (Shipped)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tabs based on selector */}
      {orderType === 'instant' ? (
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeInstantTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveInstantTab('pending')}
          >
            <View style={styles.tabContentRow}>
              <Text style={[styles.tabText, activeInstantTab === 'pending' && styles.activeTabText]}>
                New Alerts
              </Text>
              <View
                style={[
                  styles.countBadge,
                  pendingCount > 0 ? styles.countBadgePending : styles.countBadgeInactive,
                  activeInstantTab === 'pending' && pendingCount === 0 && styles.countBadgeActiveTab,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    pendingCount > 0 ? styles.countBadgeTextPending : styles.countBadgeTextInactive,
                    activeInstantTab === 'pending' && pendingCount === 0 && styles.countBadgeTextActiveTab,
                  ]}
                >
                  {pendingCount}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeInstantTab === 'preparing' && styles.activeTab]}
            onPress={() => setActiveInstantTab('preparing')}
          >
            <View style={styles.tabContentRow}>
              <Text style={[styles.tabText, activeInstantTab === 'preparing' && styles.activeTabText]}>
                Active
              </Text>
              <View
                style={[
                  styles.countBadge,
                  activeCount > 0 ? styles.countBadgeBlue : styles.countBadgeInactive,
                  activeInstantTab === 'preparing' && activeCount === 0 && styles.countBadgeActiveTab,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    activeCount > 0 ? styles.countBadgeTextBlue : styles.countBadgeTextInactive,
                    activeInstantTab === 'preparing' && activeCount === 0 && styles.countBadgeTextActiveTab,
                  ]}
                >
                  {activeCount}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeInstantTab === 'history' && styles.activeTab]}
            onPress={() => setActiveInstantTab('history')}
          >
            <View style={styles.tabContentRow}>
              <Text style={[styles.tabText, activeInstantTab === 'history' && styles.activeTabText]}>
                History
              </Text>
              <View
                style={[
                  styles.countBadge,
                  styles.countBadgeInactive,
                  activeInstantTab === 'history' && styles.countBadgeActiveTab,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    styles.countBadgeTextInactive,
                    activeInstantTab === 'history' && styles.countBadgeTextActiveTab,
                  ]}
                >
                  {historyCount}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.courierFilterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((status) => {
              const count = getCourierCount(status);
              const isActive = courierFilter === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setCourierFilter(status)}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {status.toUpperCase()} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      ) : (
        <FlatList
          data={(orderType === 'instant' ? getFilteredInstantOrders() : getFilteredCourierOrders()) as any}
          renderItem={(orderType === 'instant' ? renderInstantCard : renderCourierCard) as any}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1A1A1A']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>
                {orderType === 'instant'
                  ? activeInstantTab === 'pending'
                    ? 'No New Order Alerts'
                    : activeInstantTab === 'preparing'
                    ? 'No Active Orders'
                    : 'No Order History'
                  : `No ${courierFilter.toUpperCase()} Orders`}
              </Text>
              <Text style={styles.emptySubtitle}>
                {orderType === 'instant'
                  ? activeInstantTab === 'pending'
                    ? 'New incoming Try & Buy orders will ring and appear here.'
                    : activeInstantTab === 'preparing'
                    ? 'Orders in preparation, packing, or out for delivery will appear here.'
                    : 'Completed and past orders will be archived here.'
                  : `No courier orders currently found under filter: ${courierFilter.toUpperCase()}`}
              </Text>
            </View>
          }
        />
      )}

      {/* Packing Proof Modal */}
      <Modal
        visible={showPackingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowPackingModal(false);
          setPackingOrderId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Pack Verification</Text>
                <Text style={styles.modalSubtitle}>Provide at least 1 proof photo per item</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowPackingModal(false);
                  setPackingOrderId(null);
                }}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Items List */}
            {packingOrderId && (() => {
              const packingOrder = orders.find(o => o._id === packingOrderId);
              if (!packingOrder) return null;

              return (
                <>
                  <ScrollView style={styles.modalItemsList} contentContainerStyle={{ paddingBottom: 24 }}>
                    {packingOrder.status === 'CANCELLED' && (
                      <View style={{ backgroundColor: '#FEF2F2', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', marginBottom: 14 }}>
                        <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
                          ⚠️ Order Cancelled
                        </Text>
                        <Text style={{ color: '#991B1B', fontSize: 13, lineHeight: 18 }}>
                          This order was cancelled by the customer. Packing is no longer required.
                        </Text>
                        {packingOrder.reason ? (
                          <Text style={{ color: '#7F1D1D', fontSize: 12, marginTop: 4 }}>
                            Reason: {packingOrder.reason}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    {packingOrder.items.map((item) => {
                      const isOutOfStock = item.status === 'out_of_stock';
                      const itemPhotos = packingPhotos.filter(p => p.itemId === item._id);
                      const hasProof = itemPhotos.length > 0;

                      return (
                        <View 
                          key={item._id} 
                          style={[
                            styles.modalItemCard,
                            isOutOfStock
                              ? { backgroundColor: '#FEF2F2', borderColor: 'rgba(239, 68, 68, 0.3)', opacity: 0.9 }
                              : hasProof && { backgroundColor: '#F0FDF4', borderColor: 'rgba(22, 163, 74, 0.2)' }
                          ]}
                        >
                          {/* Item header */}
                          <View style={styles.modalItemHeader}>
                            {item.image ? (
                              <Image source={{ uri: item.image }} style={styles.modalItemThumbnail} resizeMode="cover" />
                            ) : (
                              <View style={styles.modalItemThumbnailPlaceholder}>
                                <Package size={18} color="#94A3B8" />
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.modalItemName, isOutOfStock && { textDecorationLine: 'line-through', color: '#991B1B' }]}>
                                {item.name}
                              </Text>
                              <Text style={styles.modalItemDetails}>
                                Size: {item.size || 'N/A'}  •  Qty: {item.quantity}  •  ₹{item.price}
                              </Text>
                            </View>
                            <View style={[
                              styles.modalItemBadge,
                              isOutOfStock
                                ? { backgroundColor: '#FEE2E2' }
                                : hasProof ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#F1F5F9' }
                            ]}>
                              <Text style={[
                                styles.modalItemBadgeText,
                                isOutOfStock
                                  ? { color: '#DC2626', fontWeight: '800' }
                                  : hasProof ? { color: '#16A34A' } : { color: '#64748B' }
                              ]}>
                                {isOutOfStock ? 'OUT OF STOCK' : hasProof ? `${itemPhotos.length} Photo(s)` : 'Missing Photo'}
                              </Text>
                            </View>
                          </View>

                          {/* Photos grid */}
                          {!isOutOfStock && itemPhotos.length > 0 && (
                            <View style={styles.modalPhotosGrid}>
                              {itemPhotos.map((photo) => (
                                <View key={photo._id} style={styles.modalPhotoWrapper}>
                                  <Image source={{ uri: photo.url }} style={styles.modalPhotoImg} />
                                  <TouchableOpacity
                                    style={styles.modalPhotoDeleteBtn}
                                    onPress={() => handleDeletePhoto(photo._id)}
                                  >
                                    <X size={12} color="#FFFFFF" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Action Buttons */}
                          {isOutOfStock ? (
                            <View style={styles.outOfStockNotice}>
                              <Text style={styles.outOfStockNoticeText}>Item excluded from order • Customer notified</Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                              <TouchableOpacity
                                style={[styles.modalItemUploadBtn, { flex: 1 }]}
                                onPress={() => handleTakePhoto(item._id)}
                              >
                                <Camera size={16} color="#1A1A1A" style={{ marginRight: 6 }} />
                                <Text style={styles.modalItemUploadBtnText}>Take Photo</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.modalItemOutOfStockBtn}
                                onPress={() => handleMarkOutOfStock(packingOrder._id, item._id, item.name)}
                              >
                                <AlertTriangle size={14} color="#DC2626" style={{ marginRight: 4 }} />
                                <Text style={styles.modalItemOutOfStockBtnText}>Out of Stock</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>

                  {/* Footer */}
                  <View style={styles.modalFooter}>
                    {packingOrder.status === 'CANCELLED' ? (
                      <TouchableOpacity
                        style={[styles.modalConfirmBtn, { flex: 1 }]}
                        onPress={() => {
                          setShowPackingModal(false);
                          setPackingOrderId(null);
                        }}
                      >
                        <Text style={styles.modalConfirmBtnText}>Close</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.modalCancelBtn, { marginRight: 12 }]}
                          onPress={() => {
                            setShowPackingModal(false);
                            setPackingOrderId(null);
                          }}
                        >
                          <Text style={styles.modalCancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modalConfirmBtn,
                            modalLoading && { opacity: 0.5 }
                          ]}
                          disabled={modalLoading}
                          onPress={() => handleMarkPacked(packingOrder._id)}
                        >
                          {modalLoading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.modalConfirmBtnText}>Confirm Packed</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Damage & Incident Report Modal */}
      <Modal
        visible={showDamageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDamageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Report Return Damage</Text>
                <Text style={styles.modalSubtitle}>Order #{damageOrder?._id?.slice(-6)?.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDamageModal(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {/* Item selection */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Select Affected Product:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {damageOrder?.products?.map((prod: any) => {
                  const isSelected = selectedDamageItemId === prod._id;
                  return (
                    <TouchableOpacity
                      key={prod._id}
                      onPress={() => setSelectedDamageItemId(prod._id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        marginRight: 8,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#E11D48' : '#CBD5E1',
                        backgroundColor: isSelected ? '#FFF1F2' : '#F8FAFC',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#E11D48' : '#334155' }}>
                        {prod.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        Size: {prod.size || 'N/A'} {prod.tryStatus ? `(${prod.tryStatus})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Damage Category */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Incident Category:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {[
                  { key: 'fabric_tear', label: 'Torn / Cut' },
                  { key: 'stain_dirty', label: 'Stains / Dirty' },
                  { key: 'tag_missing', label: 'Missing Tag' },
                  { key: 'broken_zipper_button', label: 'Broken Zipper' },
                  { key: 'wrong_item_returned', label: 'Wrong Item' },
                  { key: 'item_missing', label: 'Missing Item' },
                  { key: 'other', label: 'Other Issue' },
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setDamageCategory(cat.key)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: damageCategory === cat.key ? '#E11D48' : '#E2E8F0',
                      backgroundColor: damageCategory === cat.key ? '#FFE4E6' : '#FFFFFF',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: damageCategory === cat.key ? '#E11D48' : '#475569' }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Explanation of Damage / Incident:
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 14,
                  minHeight: 80,
                  textAlignVertical: 'top',
                  marginBottom: 14,
                  backgroundColor: '#FFFFFF',
                }}
                placeholder="Describe what condition the returned product is in..."
                multiline
                numberOfLines={3}
                value={damageDescription}
                onChangeText={setDamageDescription}
              />

              {/* Photos */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Evidence Photos ({damagePhotos.length}):
              </Text>
              {damagePhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {damagePhotos.map((p, idx) => (
                    <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                      <Image source={{ uri: p.uri }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                      <TouchableOpacity
                        onPress={() => setDamagePhotos((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          backgroundColor: '#EF4444',
                          borderRadius: 10,
                          width: 20,
                          height: 20,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <X size={12} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                <TouchableOpacity
                  onPress={handleTakeDamagePhoto}
                  style={{
                    flex: 1,
                    backgroundColor: '#F1F5F9',
                    paddingVertical: 10,
                    borderRadius: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                  }}
                >
                  <Camera size={16} color="#334155" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePickDamagePhoto}
                  style={{
                    flex: 1,
                    backgroundColor: '#F1F5F9',
                    paddingVertical: 10,
                    borderRadius: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                  }}
                >
                  <Package size={16} color="#334155" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>From Gallery</Text>
                </TouchableOpacity>
              </View>

              {/* Submit button */}
              <TouchableOpacity
                onPress={handleSubmitDamageReport}
                disabled={isSubmittingDamage}
                style={{
                  backgroundColor: isSubmittingDamage ? '#94A3B8' : '#E11D48',
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                {isSubmittingDamage ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Submit Damage Ticket</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reason Modal (For Reject or Cancel Request) */}
      <Modal
        visible={reasonModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReasonModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 350 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {reasonModalType === 'reject' ? 'Reject Order' : 'Request Cancellation'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Please provide a reason below:
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReasonModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  padding: 16,
                  height: 100,
                  textAlignVertical: 'top',
                  fontSize: 15,
                  backgroundColor: '#F8FAFC',
                }}
                placeholder="Type your reason here..."
                value={reasonText}
                onChangeText={setReasonText}
                multiline
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { marginRight: 12 }]}
                onPress={() => setReasonModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  reasonModalType === 'reject' ? { backgroundColor: '#EF4444' } : {}
                ]}
                onPress={handleSubmitReason}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {reasonModalType === 'reject' ? 'Reject' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  typeBtnActive: {
    backgroundColor: '#1A1A1A',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1A1A1A',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#1A1A1A',
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgePending: {
    backgroundColor: '#EF4444',
  },
  countBadgeBlue: {
    backgroundColor: '#3B82F6',
  },
  countBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  countBadgeActiveTab: {
    backgroundColor: '#E2E8F0',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  countBadgeTextPending: {
    color: '#FFFFFF',
  },
  countBadgeTextBlue: {
    color: '#FFFFFF',
  },
  countBadgeTextInactive: {
    color: '#64748B',
  },
  countBadgeTextActiveTab: {
    color: '#0F172A',
  },
  courierFilterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1.5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  orderDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  itemsSection: {
    marginVertical: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 10,
  },
  itemImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  itemQty: {
    color: '#64748B',
    fontWeight: '800',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalItemThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalItemThumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  addressSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  amountLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  amountVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  courierChargeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  otpValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1D4ED8',
    letterSpacing: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnIcon: {
    marginRight: 6,
  },
  rejectBtn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  acceptBtn: {
    borderColor: '#1A1A1A',
    backgroundColor: '#1A1A1A',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  packBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  packBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  merchantReturnSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  returnSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  returnSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  returnSectionInfo: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  returnSectionSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  returnItemText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  returnActionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  returnActionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalItemsList: {
    padding: 20,
  },
  modalItemCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  modalItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalItemDetails: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  cardHeaderTouchable: {
    paddingVertical: 2,
  },
  expandChevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalItemBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  modalPhotoWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPhotoImg: {
    width: '105%',
    height: '105%',
  },
  modalPhotoDeleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalItemUploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalItemOutOfStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  modalItemOutOfStockBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  outOfStockNotice: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginTop: 6,
    alignItems: 'center',
  },
  outOfStockNoticeText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelledBanner: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  cancelledBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cancelledBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  oosTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  oosTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  cancelledReasonText: {
    fontSize: 12,
    color: '#7F1D1D',
    fontWeight: '600',
  },
  cancelledOosExpl: {
    fontSize: 11,
    color: '#991B1B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  cancelledDateText: {
    fontSize: 10,
    color: '#991B1B',
    marginTop: 2,
  },
  itemRowOos: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    borderRadius: 8,
    padding: 4,
  },
  itemNameOos: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  itemOosBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  itemOosBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  itemOosReasonText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
  },
  itemCancelledBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemCancelledBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
});
