import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import api from '../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2, Tag, Percent, Calendar, Check, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface Offer {
  _id: string;
  title: string;
  description?: string;
  badgeText?: string;
  type: 'VENDOR_DISCOUNT' | 'VENDOR_MIN_ORDER' | 'VENDOR_CLEARANCE';
  discountType: 'percentage' | 'flat';
  discountValue: number;
  maxDiscount?: number;
  couponCode?: string;
  requiresCoupon: boolean;
  isActive: boolean;
  endDate: string;
  conditions?: {
    minCartValue: number;
  };
}

export default function OffersScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [type, setType] = useState<'VENDOR_DISCOUNT' | 'VENDOR_MIN_ORDER' | 'VENDOR_CLEARANCE'>('VENDOR_DISCOUNT');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [requiresCoupon, setRequiresCoupon] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [minCartValue, setMinCartValue] = useState('0');
  const [validDays, setValidDays] = useState('30'); // Duration instead of complex date picker

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/merchant/offers');
      setOffers(res.data?.offers || []);
    } catch (err) {
      console.error('Failed to load offers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleToggleOffer = async (id: string, currentStatus: boolean) => {
    try {
      // Optimistic state
      setOffers((prev) =>
        prev.map((o) => (o._id === id ? { ...o, isActive: !currentStatus } : o))
      );

      await api.patch(`/merchant/offers/${id}/toggle`);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to toggle status.');
      // Revert state
      setOffers((prev) =>
        prev.map((o) => (o._id === id ? { ...o, isActive: currentStatus } : o))
      );
    }
  };

  const handleDeleteOffer = (id: string) => {
    Alert.alert('Delete Promotion', 'Are you sure you want to permanently delete this offer/coupon?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/merchant/offers/${id}`);
            Alert.alert('Success', 'Offer deleted successfully.');
            fetchOffers();
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete offer.');
          }
        },
      },
    ]);
  };

  const handleCreateOffer = async () => {
    if (!title.trim() || !discountValue || !validDays) {
      Alert.alert('Error', 'Please fill in all required fields (*)');
      return;
    }

    setSubmitting(true);
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + (parseInt(validDays) || 30));

      const payload = {
        title: title.trim(),
        description: description.trim(),
        badgeText: badgeText.trim(),
        type,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        couponCode: couponCode.trim().toUpperCase() || null,
        requiresCoupon: requiresCoupon || !!couponCode,
        isPublic,
        startDate: new Date(),
        endDate: expirationDate,
        conditions: {
          minCartValue: parseFloat(minCartValue) || 0,
        },
      };

      await api.post('/merchant/offers', payload);
      Alert.alert('Success', 'Offer created successfully.');
      setModalVisible(false);
      resetForm();
      fetchOffers();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to create offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setBadgeText('');
    setType('VENDOR_DISCOUNT');
    setDiscountType('percentage');
    setDiscountValue('');
    setMaxDiscount('');
    setCouponCode('');
    setRequiresCoupon(true);
    setIsPublic(true);
    setMinCartValue('0');
    setValidDays('30');
  };

  const renderOfferItem = ({ item }: { item: Offer }) => {
    const isPercent = item.discountType === 'percentage';
    const expiryDate = new Date(item.endDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <View style={styles.couponBadge}>
            <Tag size={14} color="#1A1A1A" style={{ marginRight: 4 }} />
            <Text style={styles.couponCodeText}>{item.couponCode || 'AUTO-APPLY'}</Text>
          </View>
          <TouchableOpacity onPress={() => handleDeleteOffer(item._id)}>
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <Text style={styles.offerTitle}>{item.title}</Text>
        {item.description ? <Text style={styles.offerDesc}>{item.description}</Text> : null}

        <View style={styles.offerMetricsRow}>
          <View style={styles.metricItem}>
            <Percent size={14} color="#64748B" />
            <Text style={styles.metricText}>
              {isPercent ? `${item.discountValue}% Off` : `₹${item.discountValue} Off`}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Calendar size={14} color="#64748B" />
            <Text style={styles.metricText}>Expires: {expiryDate}</Text>
          </View>
        </View>

        {item.conditions?.minCartValue ? (
          <Text style={styles.conditionText}>
            * Applicable on orders above ₹{item.conditions.minCartValue}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.statusLabel}>Offer Active Status</Text>
          <Switch
            value={item.isActive}
            onValueChange={() => handleToggleOffer(item._id, item.isActive)}
            thumbColor={item.isActive ? '#10B981' : '#E2E8F0'}
            trackColor={{ true: '#10B98150', false: '#CBD5E1' }}
          />
        </View>
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
        <Text style={styles.headerTitle}>Promotions & Coupons</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      ) : (
        <FlatList
          data={offers}
          renderItem={renderOfferItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Tag size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Promotions Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create discount offers and custom coupons to boost your store sales.
              </Text>
            </View>
          }
        />
      )}

      {/* Creation Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Promotion</Text>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Offer Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mega Summer Discount"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Details of the offer..."
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Coupon Code</Text>
                  <TextInput
                    style={[styles.input, { textTransform: 'uppercase' }]}
                    placeholder="e.g. SUM50"
                    placeholderTextColor="#94A3B8"
                    value={couponCode}
                    onChangeText={setCouponCode}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Badge text (label)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. HOT"
                    placeholderTextColor="#94A3B8"
                    value={badgeText}
                    onChangeText={setBadgeText}
                  />
                </View>
              </View>

              <Text style={styles.label}>Coupon Visibility</Text>
              <View style={styles.choiceRow}>
                <TouchableOpacity
                  style={[styles.choiceBtn, isPublic && styles.choiceBtnActive]}
                  onPress={() => setIsPublic(true)}
                >
                  <Text style={[styles.choiceBtnText, isPublic && styles.choiceBtnTextActive]}>
                    PUBLIC (LISTED)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.choiceBtn, !isPublic && styles.choiceBtnActive]}
                  onPress={() => setIsPublic(false)}
                >
                  <Text style={[styles.choiceBtnText, !isPublic && styles.choiceBtnTextActive]}>
                    PRIVATE (HIDDEN)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Promotion Type *</Text>
              <View style={styles.choiceRow}>
                {['VENDOR_DISCOUNT', 'VENDOR_MIN_ORDER', 'VENDOR_CLEARANCE'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.choiceBtn, type === t && styles.choiceBtnActive]}
                    onPress={() => setType(t as any)}
                  >
                    <Text style={[styles.choiceBtnText, type === t && styles.choiceBtnTextActive]}>
                      {t.replace('VENDOR_', '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Discount Type *</Text>
              <View style={styles.choiceRow}>
                {['percentage', 'flat'].map((dt) => (
                  <TouchableOpacity
                    key={dt}
                    style={[styles.choiceBtn, discountType === dt && styles.choiceBtnActive]}
                    onPress={() => setDiscountType(dt as any)}
                  >
                    <Text style={[styles.choiceBtnText, discountType === dt && styles.choiceBtnTextActive]}>
                      {dt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Discount Value *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={discountType === 'percentage' ? 'e.g. 15 (%)' : 'e.g. 200 (₹)'}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={discountValue}
                    onChangeText={setDiscountValue}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Max Discount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={maxDiscount}
                    onChangeText={setMaxDiscount}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Min Cart Value (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 499"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={minCartValue}
                    onChangeText={setMinCartValue}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Validity Days *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 30"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={validDays}
                    onChangeText={setValidDays}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleCreateOffer}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalSaveText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  couponBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  couponCodeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  offerDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  offerMetricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  conditionText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  modalForm: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  textArea: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtnActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  choiceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 15,
  },
  modalSaveBtn: {
    backgroundColor: '#1A1A1A',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
