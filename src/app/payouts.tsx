import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import api, {
  getMerchantPayoutHistory,
  getMerchantCurrentWeek,
  getMerchantWallet,
} from '@/utils/api';
import {
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  CreditCard,
  Building2,
  Copy,
  Check,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  ExternalLink,
  Sparkles,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PayoutRecord {
  _id: string;
  amount?: number;
  finalAmount?: number;
  netPayout?: number;
  status: 'paid' | 'failed' | 'finalized' | 'accumulating' | 'completed' | string;
  createdAt: string;
  weekStart?: string;
  weekEnd?: string;
  transactionId?: string;
  referenceNumber?: string;
  paymentMethod?: string;
  totalEarnings?: number;
  totalGrossSales?: number;
  totalCommission?: number;
  totalDeductions?: number;
  adminDeduction?: {
    amount: number;
    reason: string;
  };
  receipt?: {
    url?: string;
    public_id?: string;
  };
  paidAt?: string;
  notes?: string;
  isManual?: boolean;
}

export default function PayoutsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'finalized' | 'paid'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Financial States
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [currentWeekPayout, setCurrentWeekPayout] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [bankDetails, setBankDetails] = useState<any>(null);

  // Receipt Modal State
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [selectedReceiptTitle, setSelectedReceiptTitle] = useState<string>('');

  // Copy indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchPayoutData = async () => {
    try {
      const [historyRes, currentWeekRes, walletRes, merchantRes] = await Promise.all([
        getMerchantPayoutHistory(1, 50).catch(() => ({ payouts: [] })),
        getMerchantCurrentWeek().catch(() => null),
        getMerchantWallet().catch(() => ({ balance: 0 })),
        api.get('merchant/getMerchant').catch(() => null),
      ]);

      const list: PayoutRecord[] = historyRes?.history || historyRes?.payouts || [];
      setPayouts(list);

      if (currentWeekRes?.success && currentWeekRes.payout) {
        setCurrentWeekPayout(currentWeekRes.payout);
      }

      if (walletRes?.balance !== undefined) {
        setWalletBalance(walletRes.balance);
      }

      const m = merchantRes?.data?.merchant || merchantRes?.data;
      if (m?.bankDetails) {
        setBankDetails(m.bankDetails);
      }
    } catch (err) {
      console.error('Failed to load payouts data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayoutData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPayoutData();
  };

  const copyText = async (text: string, key: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openReceipt = (url: string, title: string) => {
    setSelectedReceiptUrl(url);
    setSelectedReceiptTitle(title);
    setReceiptModalVisible(true);
  };

  // Metrics
  const totalSettled = useMemo(() => {
    return payouts
      .filter((p) => (p.status || '').toLowerCase() === 'paid')
      .reduce((sum, p) => sum + (p.finalAmount ?? p.netPayout ?? p.amount ?? 0), 0);
  }, [payouts]);

  const totalFinalizedPending = useMemo(() => {
    return payouts
      .filter((p) => (p.status || '').toLowerCase() === 'finalized')
      .reduce((sum, p) => sum + (p.finalAmount ?? p.netPayout ?? p.amount ?? 0), 0);
  }, [payouts]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      const st = (p.status || '').toLowerCase();
      if (filterTab === 'finalized') return st === 'finalized';
      if (filterTab === 'paid') return st === 'paid' || st === 'completed' || st === 'success';
      return true;
    });
  }, [payouts, filterTab]);

  const getStatusBadge = (status: string) => {
    const st = (status || '').toLowerCase();
    if (st === 'paid' || st === 'completed' || st === 'success') {
      return { label: 'PAID', bg: '#DCFCE7', text: '#15803D', icon: CheckCircle2, desc: 'Transferred to Bank' };
    }
    if (st === 'finalized') {
      return {
        label: 'TRANSFER IN PROGRESS',
        bg: '#EEF2FF',
        text: '#4338CA',
        icon: ShieldCheck,
        desc: 'Audited & Locked • Transfer Pending',
      };
    }
    if (st === 'accumulating' || st === 'pending') {
      return { label: 'ACCUMULATING', bg: '#FEF3C7', text: '#B45309', icon: Clock, desc: 'Cycle in progress' };
    }
    return { label: 'FAILED', bg: '#FEE2E2', text: '#B91C1C', icon: AlertCircle, desc: 'Settlement issue' };
  };

  const maskAccount = (num?: string) => {
    if (!num) return '••••';
    const clean = String(num);
    if (clean.length <= 4) return clean;
    return `•••• •••• ${clean.slice(-4)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>Loading Weekly Payout Records...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1A1A1A']} />
        }
      >
        {/* ── TOP STATS OVERVIEW ── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroSub}>Weekly Bank Settlements</Text>
          <Text style={styles.heroAmount}>₹{totalSettled.toLocaleString('en-IN')}</Text>
          <Text style={styles.heroSubMeta}>Total lifetime settled to registered bank account</Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <Text style={styles.heroColLabel}>Transfer In Progress</Text>
              <Text style={[styles.heroColVal, { color: '#818CF8' }]}>
                ₹{totalFinalizedPending.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroColHint}>Finalized cycles</Text>
            </View>

            <View style={styles.heroColBorder} />

            <View style={styles.heroCol}>
              <Text style={styles.heroColLabel}>This Week Projected</Text>
              <Text style={[styles.heroColVal, { color: '#34D399' }]}>
                ₹{(currentWeekPayout?.netPayout ?? 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroColHint}>Settles every Tuesday</Text>
            </View>
          </View>
        </View>

        {/* ── REGISTERED BANK DESTINATION CARD ── */}
        <View style={styles.bankCard}>
          <View style={styles.bankHeader}>
            <View style={styles.bankIconCircle}>
              <Building2 size={18} color="#1E293B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankTitle}>Registered Settlement Account</Text>
              <Text style={styles.bankSub}>Manual payouts are transferred directly to this account</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <CheckCircle2 size={12} color="#16A34A" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          {bankDetails?.accountNumber ? (
            <View style={styles.bankDetailsGrid}>
              <View style={styles.bankDetailItem}>
                <Text style={styles.bankDetailLabel}>Bank</Text>
                <Text style={styles.bankDetailVal}>{bankDetails.bankName || 'Partner Bank'}</Text>
              </View>
              <View style={styles.bankDetailItem}>
                <Text style={styles.bankDetailLabel}>Account No.</Text>
                <Text style={styles.bankDetailValMono}>{maskAccount(bankDetails.accountNumber)}</Text>
              </View>
              <View style={styles.bankDetailItem}>
                <Text style={styles.bankDetailLabel}>IFSC Code</Text>
                <Text style={styles.bankDetailValMono}>{bankDetails.ifscCode || 'N/A'}</Text>
              </View>
              {bankDetails.upiId && (
                <View style={styles.bankDetailItem}>
                  <Text style={styles.bankDetailLabel}>UPI ID</Text>
                  <Text style={[styles.bankDetailVal, { color: '#15803D' }]}>{bankDetails.upiId}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noBankNotice}>
              <AlertCircle size={16} color="#D97706" />
              <Text style={styles.noBankText}>
                No bank account details saved. Please update in Store Profile to receive payouts.
              </Text>
            </View>
          )}
        </View>

        {/* ── FILTER CHIPS ── */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterTab === 'all' && styles.filterChipActive]}
            onPress={() => setFilterTab('all')}
          >
            <Text style={[styles.filterChipText, filterTab === 'all' && styles.filterChipTextActive]}>
              All ({payouts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterTab === 'finalized' && styles.filterChipActive]}
            onPress={() => setFilterTab('finalized')}
          >
            <Text style={[styles.filterChipText, filterTab === 'finalized' && styles.filterChipTextActive]}>
              In Progress ({payouts.filter((p) => (p.status || '').toLowerCase() === 'finalized').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterTab === 'paid' && styles.filterChipActive]}
            onPress={() => setFilterTab('paid')}
          >
            <Text style={[styles.filterChipText, filterTab === 'paid' && styles.filterChipTextActive]}>
              Paid ({payouts.filter((p) => (p.status || '').toLowerCase() === 'paid').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── PAYOUTS LIST ── */}
        {filteredPayouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <CreditCard size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Payout Records in this Tab</Text>
            <Text style={styles.emptySub}>
              Payouts accumulate weekly from Monday to Sunday, get audited and finalized, and settle to your bank account.
            </Text>
          </View>
        ) : (
          filteredPayouts.map((item) => {
            const isExpanded = expandedId === item._id;
            const badge = getStatusBadge(item.status);
            const BadgeIcon = badge.icon;
            const displayAmount = item.finalAmount ?? item.netPayout ?? item.amount ?? 0;
            const grossAmount = item.totalGrossSales || (displayAmount > 0 ? Math.round(displayAmount / 0.96) : 0);
            const commission = item.totalCommission || Math.max(0, grossAmount - displayAmount);
            const hasReceipt = Boolean(item.receipt?.url);
            const isFinalized = (item.status || '').toLowerCase() === 'finalized';
            const isPaid = (item.status || '').toLowerCase() === 'paid';

            let dateLabel = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            if (item.weekStart && item.weekEnd) {
              const start = new Date(item.weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' });
              const end = new Date(item.weekEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              dateLabel = `${start} - ${end}`;
            }

            return (
              <View key={item._id} style={styles.payoutCard}>
                {/* Card Header Top */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(isExpanded ? null : item._id)}
                  style={styles.payoutTopTouch}
                >
                  <View style={styles.payoutHeaderRow}>
                    <View style={styles.payoutHeaderLeft}>
                      <View style={styles.weekCalendarBadge}>
                        <Calendar size={14} color="#2563EB" />
                      </View>
                      <View>
                        <Text style={styles.payoutCycleLabel}>{dateLabel}</Text>
                        <Text style={styles.payoutSubCycle}>Weekly Settlement Cycle</Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.payoutAmountText}>
                        ₹{displayAmount.toLocaleString('en-IN')}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: badge.bg, marginTop: 4 }]}>
                        <BadgeIcon size={10} color={badge.text} style={{ marginRight: 3 }} />
                        <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Status Notice Banners */}
                {isFinalized && (
                  <View style={styles.finalizedBanner}>
                    <ShieldCheck size={16} color="#4338CA" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.finalizedBannerTitle}>Earnings Verified & Finalized</Text>
                      <Text style={styles.finalizedBannerText}>
                        FlashFits finance team is executing the manual bank transfer for this cycle. Status will update to PAID with receipt proof once transfer completes.
                      </Text>
                    </View>
                  </View>
                )}

                {isPaid && item.paidAt && (
                  <View style={styles.paidBanner}>
                    <CheckCircle2 size={15} color="#15803D" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paidBannerText}>
                        Transferred on{' '}
                        {new Date(item.paidAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {item.referenceNumber ? ` • Ref: ${item.referenceNumber}` : ''}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Expandable Breakdown Drawer */}
                {isExpanded && (
                  <View style={styles.expandedDrawer}>
                    <View style={styles.drawerDivider} />

                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Gross Product Sales</Text>
                      <Text style={styles.breakdownVal}>₹{grossAmount.toLocaleString('en-IN')}</Text>
                    </View>

                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: '#EF4444' }]}>FlashFits Platform Cut (4%)</Text>
                      <Text style={[styles.breakdownVal, { color: '#EF4444' }]}>-₹{commission.toLocaleString('en-IN')}</Text>
                    </View>

                    {item.totalDeductions !== undefined && item.totalDeductions > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: '#EF4444' }]}>Penalty / Damage Deduction</Text>
                        <Text style={[styles.breakdownVal, { color: '#EF4444' }]}>
                          -₹{item.totalDeductions.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}

                    {item.adminDeduction && item.adminDeduction.amount > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: '#EF4444' }]}>
                          Adjustment ({item.adminDeduction.reason || 'Admin adjustment'})
                        </Text>
                        <Text style={[styles.breakdownVal, { color: '#EF4444' }]}>
                          -₹{item.adminDeduction.amount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}

                    <View style={styles.drawerDividerLight} />

                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { fontWeight: '800', color: '#0F172A' }]}>
                        Net Bank Transfer
                      </Text>
                      <Text style={[styles.breakdownVal, { fontWeight: '900', color: '#16A34A', fontSize: 16 }]}>
                        ₹{displayAmount.toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {/* UTR Copy Row */}
                    {item.referenceNumber && (
                      <View style={styles.utrBox}>
                        <CreditCard size={13} color="#64748B" />
                        <Text style={styles.utrText}>Bank Ref / UTR: {item.referenceNumber}</Text>
                        <TouchableOpacity
                          onPress={() => copyText(item.referenceNumber!, item._id)}
                          style={styles.copyBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {copiedKey === item._id ? (
                            <Check size={13} color="#15803D" />
                          ) : (
                            <Copy size={13} color="#64748B" />
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* RECEIPT / BILL BUTTON */}
                    {hasReceipt ? (
                      <TouchableOpacity
                        style={styles.viewReceiptBtn}
                        onPress={() => openReceipt(item.receipt!.url!, `Payment Receipt (${dateLabel})`)}
                        activeOpacity={0.8}
                      >
                        <FileText size={15} color="#2563EB" />
                        <Text style={styles.viewReceiptBtnText}>View Official Payment Receipt / Bill</Text>
                        <ExternalLink size={13} color="#2563EB" />
                      </TouchableOpacity>
                    ) : isPaid ? (
                      <View style={styles.noReceiptBox}>
                        <Text style={styles.noReceiptText}>Bank Transfer Settled directly via NEFT/IMPS</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Footer Toggle */}
                <TouchableOpacity
                  style={styles.cardFooter}
                  onPress={() => setExpandedId(isExpanded ? null : item._id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerToggleText}>
                    {isExpanded ? 'Hide itemized breakdown' : 'Tap to view financial split & receipt'}
                  </Text>
                  {isExpanded ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL: FULLSCREEN RECEIPT VIEWER ── */}
      <Modal
        visible={receiptModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedReceiptTitle}</Text>
                <Text style={styles.modalSub}>FlashFits Official Transfer Confirmation</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setReceiptModalVisible(false)}
              >
                <X size={20} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Receipt Image Display */}
            <View style={styles.receiptImageContainer}>
              {selectedReceiptUrl ? (
                <Image
                  source={{ uri: selectedReceiptUrl }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: '#64748B' }}>No receipt image URL provided</Text>
              )}
            </View>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setReceiptModalVisible(false)}
              >
                <Text style={styles.modalDoneBtnText}>Done</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  heroSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroSubMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCol: {
    flex: 1,
  },
  heroColBorder: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 12,
  },
  heroColLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  heroColVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  heroColHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  // Bank Destination Card
  bankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bankIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  bankTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  bankSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  bankDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bankDetailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
  },
  bankDetailLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  bankDetailVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 2,
  },
  bankDetailValMono: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  noBankNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    gap: 6,
  },
  noBankText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    fontWeight: '600',
  },

  // Filter Chips
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // Payout Card
  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  payoutTopTouch: {
    padding: 16,
  },
  payoutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  payoutHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekCalendarBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutCycleLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  payoutSubCycle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  payoutAmountText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Finalized Banner
  finalizedBanner: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'flex-start',
  },
  finalizedBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3730A3',
  },
  finalizedBannerText: {
    fontSize: 10.5,
    color: '#4338CA',
    marginTop: 2,
    lineHeight: 14,
  },

  // Paid Banner
  paidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  paidBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },

  // Expandable Drawer
  expandedDrawer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  drawerDividerLight: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  utrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    borderRadius: 10,
    marginTop: 8,
    gap: 6,
  },
  utrText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
    fontWeight: '600',
  },
  copyBtn: {
    padding: 4,
  },
  viewReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 6,
  },
  viewReceiptBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  noReceiptBox: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignItems: 'center',
  },
  noReceiptText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontStyle: 'italic',
  },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerToggleText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  receiptImageContainer: {
    padding: 12,
    backgroundColor: '#0F172A',
    minHeight: 320,
    maxHeight: 460,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  modalDoneBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
