import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import api from '../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShoppingBag, History, Plus, Minus, AlertCircle, Calendar } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface ZipCoverOrder {
  _id: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  quantities: {
    small: number;
    medium: number;
    large: number;
  };
  remarks?: string;
  createdAt: string;
}

export default function ZipCoversScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');
  const [orders, setOrders] = useState<ZipCoverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [small, setSmall] = useState(0);
  const [medium, setMedium] = useState(0);
  const [large, setLarge] = useState(0);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/merchant/zip-covers');
      setOrders(res.data?.orders || res.data || []);
    } catch (err) {
      console.error('Failed to load zip cover orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const adjustQty = (size: 'small' | 'medium' | 'large', type: 'inc' | 'dec') => {
    const getter = size === 'small' ? small : size === 'medium' ? medium : large;
    const setter = size === 'small' ? setSmall : size === 'medium' ? setMedium : setLarge;

    if (type === 'inc') {
      if (getter >= 30) {
        Alert.alert('Limit Reached', 'Maximum 30 covers per size allowed per order.');
        return;
      }
      setter(getter + 1);
    } else {
      if (getter <= 0) return;
      setter(getter - 1);
    }
  };

  const handleSubmitRequest = async () => {
    if (small === 0 && medium === 0 && large === 0) {
      Alert.alert('Error', 'Please select at least one zip cover.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/merchant/zip-covers/order', {
        small,
        medium,
        large,
      });

      Alert.alert('Success', 'Zip covers ordered successfully!');
      setSmall(0);
      setMedium(0);
      setLarge(0);
      fetchOrders();
      setActiveTab('history');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to request covers.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: '#D97706', bg: '#FEF3C7' };
      case 'shipped':
        return { text: '#2563EB', bg: '#DBEAFE' };
      case 'delivered':
        return { text: '#059669', bg: '#D1FAE5' };
      case 'cancelled':
        return { text: '#DC2626', bg: '#FEE2E2' };
      default:
        return { text: '#475569', bg: '#F1F5F9' };
    }
  };

  const renderHistoryItem = ({ item }: { item: ZipCoverOrder }) => {
    const statusStyle = getStatusColor(item.status);
    const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View style={styles.dateRow}>
            <Calendar size={14} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.dateText}>{date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.qtyContainer}>
          {item.quantities.small > 0 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>Small: {item.quantities.small}</Text>
            </View>
          )}
          {item.quantities.medium > 0 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>Medium: {item.quantities.medium}</Text>
            </View>
          )}
          {item.quantities.large > 0 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>Large: {item.quantities.large}</Text>
            </View>
          )}
        </View>

        {item.remarks ? (
          <View style={styles.remarksBox}>
            <AlertCircle size={12} color="#64748B" style={{ marginRight: 4 }} />
            <Text style={styles.remarksText}>{item.remarks}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Zip Covers</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('request')}
          style={[styles.tabButton, activeTab === 'request' && styles.tabButtonActive]}
        >
          <ShoppingBag size={16} color={activeTab === 'request' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabButtonText, activeTab === 'request' && styles.tabButtonTextActive]}>
            Request Covers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
        >
          <History size={16} color={activeTab === 'history' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
            Order History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Panels */}
      {activeTab === 'request' ? (
        <ScrollView style={styles.formPanel} contentContainerStyle={styles.formPanelContent}>
          <Text style={styles.cardInfo}>FlashFits premium packaging zip covers. Maximum 30 covers per size per request order.</Text>

          {/* Size Selectors */}
          <View style={styles.counterCard}>
            <View style={styles.counterRow}>
              <View>
                <Text style={styles.sizeTitle}>Small Size Covers</Text>
                <Text style={styles.sizeSubtitle}>For socks, accessories, small tops</Text>
              </View>
              <View style={styles.counterControls}>
                <TouchableOpacity style={styles.btnRound} onPress={() => adjustQty('small', 'dec')}>
                  <Minus size={16} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.qtyVal}>{small}</Text>
                <TouchableOpacity style={styles.btnRound} onPress={() => adjustQty('small', 'inc')}>
                  <Plus size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.counterRow}>
              <View>
                <Text style={styles.sizeTitle}>Medium Size Covers</Text>
                <Text style={styles.sizeSubtitle}>For t-shirts, shirts, shorts</Text>
              </View>
              <View style={styles.counterControls}>
                <TouchableOpacity style={styles.btnRound} onPress={() => adjustQty('medium', 'dec')}>
                  <Minus size={16} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.qtyVal}>{medium}</Text>
                <TouchableOpacity style={styles.btnRound} onPress={() => adjustQty('medium', 'inc')}>
                  <Plus size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.counterRow}>
              <View>
                <Text style={styles.sizeTitle}>Large Size Covers</Text>
                <Text style={styles.sizeSubtitle}>For hoodies, jeans, heavy jackets</Text>
              </View>
              <View style={styles.counterControls}>
                <TouchableOpacity style={styles.btnRound} onPress={() => adjustQty('large', 'dec')}>
                  <Minus size={16} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.qtyVal}>{large}</Text>
                <TouchableOpacity style={styles.btnRound} onPress={() => adjustQty('large', 'inc')}>
                  <Plus size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmitRequest}
            disabled={submitting || (small === 0 && medium === 0 && large === 0)}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Place Cover Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1A1A1A" />
            </View>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <ShoppingBag size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Cover Requests</Text>
                  <Text style={styles.emptySubtitle}>
                    You have not requested any packaging zip covers yet. Select quantities to submit a request.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#1A1A1A',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  formPanel: {
    flex: 1,
  },
  formPanelContent: {
    padding: 16,
  },
  cardInfo: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  counterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 24,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  sizeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  sizeSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btnRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  qtyVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A1A1A',
    width: 24,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 0.5,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  qtyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  qtyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qtyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  remarksBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  remarksText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
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
});
