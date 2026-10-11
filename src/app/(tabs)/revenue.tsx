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
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import api, {
  getMerchantAnalytics,
  getMerchantCurrentWeek,
  getMerchantPayoutHistory,
  getMerchantWallet,
} from '../../utils/api';
import {
  getPastWeeks,
  PastWeekOption,
} from '../../utils/dateUtils';
import {
  DollarSign,
  TrendingUp,
  Package,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  ChevronUp,
  CreditCard,
  X,
  RotateCcw,
  FileText,
  ExternalLink,
} from 'lucide-react-native';

interface PayoutLog {
  _id: string;
  amount?: number;
  finalAmount?: number;
  netPayout?: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'paid' | 'failed' | 'finalized' | 'accumulating' | 'completed';
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
  isManual?: boolean;
}

interface WeekDailyItem {
  day: string;
  amount: number;
  date?: string;
}

export default function RevenueScreen() {
  const router = useRouter();
  const pastWeeks = useMemo(() => getPastWeeks(12), []);
  const [selectedWeek, setSelectedWeek] = useState<PastWeekOption>(pastWeeks[0]);
  const [weekModalVisible, setWeekModalVisible] = useState(false);
  const [expandedPayoutId, setExpandedPayoutId] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);
  const [activeReceiptTitle, setActiveReceiptTitle] = useState('');

  // Data states
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [currentWeekPayout, setCurrentWeekPayout] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<WeekDailyItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutLog[]>([]);

  // Loaders
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch initial general data (wallet, current week, payout history)
  const fetchBaseData = async () => {
    try {
      const [walletRes, currentWeekRes, historyRes] = await Promise.all([
        getMerchantWallet().catch(() => ({ balance: 0 })),
        getMerchantCurrentWeek().catch(() => null),
        getMerchantPayoutHistory(1, 20).catch(() => ({ payouts: [] })),
      ]);

      if (walletRes?.balance !== undefined) {
        setWalletBalance(walletRes.balance);
      }

      if (currentWeekRes?.success) {
        setCurrentWeekPayout(currentWeekRes.payout);
      }

      const payoutList = historyRes?.history || historyRes?.payouts || [];
      setPayouts(payoutList);
    } catch (err) {
      console.error('Failed to load base financial data:', err);
    }
  };

  // Fetch specific analytics & daily breakdown for the selected week
  const fetchWeekAnalytics = async (week: PastWeekOption) => {
    setWeekLoading(true);
    try {
      if (week.isCurrent) {
        // Fetch current week live breakdown & analytics
        const [analyticsRes, currentWeekRes] = await Promise.all([
          getMerchantAnalytics(week.startDate, week.endDate).catch(() => null),
          getMerchantCurrentWeek().catch(() => null),
        ]);

        if (analyticsRes?.stats) {
          setAnalyticsData(analyticsRes);
        }

        if (currentWeekRes?.dailyBreakdown) {
          setDailyBreakdown(currentWeekRes.dailyBreakdown);
        } else if (analyticsRes?.dailyTrend) {
          const mapped = mapDailyTrendToDays(analyticsRes.dailyTrend);
          setDailyBreakdown(mapped);
        }
      } else {
        // Past week
        const analyticsRes = await getMerchantAnalytics(week.startDate, week.endDate).catch(() => null);
        if (analyticsRes) {
          setAnalyticsData(analyticsRes);
          if (analyticsRes.dailyTrend) {
            setDailyBreakdown(mapDailyTrendToDays(analyticsRes.dailyTrend));
          } else {
            setDailyBreakdown(createEmptyDays());
          }
        }
      }
    } catch (err) {
      console.error('Failed to load week analytics:', err);
    } finally {
      setWeekLoading(false);
    }
  };

  const mapDailyTrendToDays = (dailyTrend: any[]): WeekDailyItem[] => {
    const dayMap: Record<string, number> = {
      Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0,
    };
    dailyTrend.forEach((item) => {
      if (item.date) {
        const d = new Date(item.date);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = dayNames[d.getDay()];
        if (dayMap[dayName] !== undefined) {
          dayMap[dayName] += item.revenue || item.amount || 0;
        }
      }
    });
    return [
      { day: 'Mon', amount: dayMap.Mon },
      { day: 'Tue', amount: dayMap.Tue },
      { day: 'Wed', amount: dayMap.Wed },
      { day: 'Thu', amount: dayMap.Thu },
      { day: 'Fri', amount: dayMap.Fri },
      { day: 'Sat', amount: dayMap.Sat },
      { day: 'Sun', amount: dayMap.Sun },
    ];
  };

  const createEmptyDays = (): WeekDailyItem[] => [
    { day: 'Mon', amount: 0 },
    { day: 'Tue', amount: 0 },
    { day: 'Wed', amount: 0 },
    { day: 'Thu', amount: 0 },
    { day: 'Fri', amount: 0 },
    { day: 'Sat', amount: 0 },
    { day: 'Sun', amount: 0 },
  ];

  const loadAll = async () => {
    setLoading(true);
    await fetchBaseData();
    await fetchWeekAnalytics(selectedWeek);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSelectWeek = (week: PastWeekOption) => {
    setSelectedWeek(week);
    setWeekModalVisible(false);
    fetchWeekAnalytics(week);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBaseData();
    fetchWeekAnalytics(selectedWeek).finally(() => setRefreshing(false));
  };

  // Find linked historical payout for the selected week if it's a past week
  const matchedPastPayout = useMemo(() => {
    if (selectedWeek.isCurrent) return null;
    return payouts.find((p) => {
      if (!p.weekStart) return false;
      const pStart = p.weekStart.split('T')[0];
      return pStart === selectedWeek.startDate;
    });
  }, [selectedWeek, payouts]);

  const stats = useMemo(() => {
    const s = analyticsData?.stats || {};
    return {
      totalRevenue: s.totalRevenue || 0,
      totalOrders: s.totalOrders || 0,
      deliveredOrders: s.deliveredOrders || 0,
      cancelledOrders: s.cancelledOrders || 0,
      avgOrderValue: s.avgOrderValue || 0,
      returnRate: s.returnRate || 0,
      deliveryRate: s.deliveryRate || 0,
    };
  }, [analyticsData]);

  const maxDailyAmount = useMemo(() => {
    const max = Math.max(...dailyBreakdown.map((d) => d.amount), 1);
    return max;
  }, [dailyBreakdown]);

  const getPayoutStatusBadge = (status: string) => {
    const st = (status || '').toLowerCase();
    if (st === 'paid' || st === 'success' || st === 'completed') {
      return { label: 'PAID', bg: '#DCFCE7', text: '#15803D', icon: CheckCircle2 };
    }
    if (st === 'accumulating' || st === 'pending') {
      return { label: 'ACCUMULATING', bg: '#FEF3C7', text: '#B45309', icon: Clock };
    }
    if (st === 'finalized') {
      return { label: 'FINALIZED', bg: '#E0E7FF', text: '#4338CA', icon: ShieldCheck };
    }
    return { label: 'FAILED', bg: '#FEE2E2', text: '#B91C1C', icon: AlertCircle };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>Loading Financial Records...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1A1A1A']} />
      }
    >
      {/* ── TOP HERO CARD: LIVE WALLET & SETTLEMENT SCHEDULE ── */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroSubtitle}>Current Wallet Balance</Text>
            <Text style={styles.heroAmount}>₹{walletBalance.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.heroBadge}>
            <Clock size={13} color="#10B981" style={{ marginRight: 4 }} />
            <Text style={styles.heroBadgeText}>Weekly Tuesday Payout</Text>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaCol}>
            <Text style={styles.heroMetaLabel}>This Week Pending</Text>
            <Text style={styles.heroMetaValue}>
              ₹{(currentWeekPayout?.netPayout ?? currentWeekPayout?.totalEarnings ?? 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.heroMetaCol}>
            <Text style={styles.heroMetaLabel}>Next Settlement</Text>
            <Text style={styles.heroMetaValue}>Upcoming Tuesday</Text>
          </View>
          <View style={styles.heroMetaCol}>
            <Text style={styles.heroMetaLabel}>Cycle Status</Text>
            <Text style={[styles.heroMetaValue, { color: '#34D399' }]}>
              {currentWeekPayout?.status ? currentWeekPayout.status.toUpperCase() : 'ACCUMULATING'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── INTERACTIVE WEEK SELECTOR (THIS WEEK / LAST WEEK / CUSTOM) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Weekly Earnings Overview</Text>
        <TouchableOpacity
          style={styles.weekPickerBtn}
          onPress={() => setWeekModalVisible(true)}
          activeOpacity={0.7}
        >
          <Calendar size={14} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.weekPickerBtnText}>
            {selectedWeek.isCurrent ? 'This Week' : selectedWeek.label}
          </Text>
          <ChevronDown size={14} color="#2563EB" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Quick Week Switcher Tabs */}
      <View style={styles.quickWeekTabs}>
        <TouchableOpacity
          style={[styles.quickWeekTab, selectedWeek.value === pastWeeks[0].value && styles.quickWeekTabActive]}
          onPress={() => handleSelectWeek(pastWeeks[0])}
        >
          <Text style={[styles.quickWeekTabText, selectedWeek.value === pastWeeks[0].value && styles.quickWeekTabTextActive]}>
            This Week (Live)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickWeekTab, selectedWeek.value === pastWeeks[1].value && styles.quickWeekTabActive]}
          onPress={() => handleSelectWeek(pastWeeks[1])}
        >
          <Text style={[styles.quickWeekTabText, selectedWeek.value === pastWeeks[1].value && styles.quickWeekTabTextActive]}>
            Last Week
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickWeekTab, selectedWeek.value === pastWeeks[2].value && styles.quickWeekTabActive]}
          onPress={() => handleSelectWeek(pastWeeks[2])}
        >
          <Text style={[styles.quickWeekTabText, selectedWeek.value === pastWeeks[2].value && styles.quickWeekTabTextActive]}>
            2 Wks Ago
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── WEEK CARD: SELECTED WEEK NET EARNINGS & STATUS ── */}
      <View style={styles.weekSummaryCard}>
        <View style={styles.weekSummaryHeader}>
          <View>
            <Text style={styles.weekSummaryLabel}>
              {selectedWeek.isCurrent ? "This Week's Projected Payout" : `Earnings for ${selectedWeek.label}`}
            </Text>
            <Text style={styles.weekSummaryAmount}>
              ₹
              {selectedWeek.isCurrent
                ? (currentWeekPayout?.netPayout ?? stats.totalRevenue).toLocaleString('en-IN')
                : (matchedPastPayout?.finalAmount ?? matchedPastPayout?.netPayout ?? stats.totalRevenue).toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Status Badge */}
          {(() => {
            const statusKey = selectedWeek.isCurrent
              ? (currentWeekPayout?.status || 'accumulating')
              : (matchedPastPayout?.status || (stats.totalRevenue > 0 ? 'finalized' : 'accumulating'));
            const badge = getPayoutStatusBadge(statusKey);
            const BadgeIcon = badge.icon;
            return (
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <BadgeIcon size={12} color={badge.text} style={{ marginRight: 4 }} />
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            );
          })()}
        </View>

        {/* Platform 4% Commission Split Breakdown */}
        {(() => {
          const netVal = selectedWeek.isCurrent
            ? (currentWeekPayout?.netPayout ?? stats.totalRevenue ?? 0)
            : (matchedPastPayout?.finalAmount ?? matchedPastPayout?.netPayout ?? stats.totalRevenue ?? 0);
          const grossVal = selectedWeek.isCurrent
            ? (currentWeekPayout?.totalGrossSales || (netVal > 0 ? Math.round(netVal / 0.96) : 0))
            : (matchedPastPayout?.totalGrossSales || (netVal > 0 ? Math.round(netVal / 0.96) : 0));
          const commVal = selectedWeek.isCurrent
            ? (currentWeekPayout?.totalCommission || Math.max(0, grossVal - netVal))
            : (matchedPastPayout?.totalCommission || Math.max(0, grossVal - netVal));

          if (grossVal <= 0) return null;

          return (
            <View style={styles.commissionSplitBox}>
              <Text style={styles.commissionSplitText}>
                Gross: <Text style={{ fontWeight: '700', color: '#0F172A' }}>₹{grossVal.toLocaleString('en-IN')}</Text>
                {'  •  '}
                4% Cut: <Text style={{ fontWeight: '700', color: '#EF4444' }}>-₹{commVal.toLocaleString('en-IN')}</Text>
                {'  •  '}
                Net: <Text style={{ fontWeight: '700', color: '#10B981' }}>₹{netVal.toLocaleString('en-IN')}</Text>
              </Text>
            </View>
          );
        })()}

        {/* Audit Note / Settlement date */}
        {!selectedWeek.isCurrent && matchedPastPayout?.paidAt && (
          <View style={styles.paidNoticeBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <CheckCircle2 size={14} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={styles.paidNoticeText}>
                Transferred on {new Date(matchedPastPayout.paidAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                {matchedPastPayout.referenceNumber ? ` • Ref: ${matchedPastPayout.referenceNumber}` : ''}
              </Text>
            </View>
            {matchedPastPayout.receipt?.url && (
              <TouchableOpacity
                style={styles.weekReceiptBtn}
                onPress={() => {
                  setActiveReceiptUrl(matchedPastPayout.receipt!.url!);
                  setActiveReceiptTitle(`Payment Receipt (${selectedWeek.label})`);
                  setReceiptModalVisible(true);
                }}
              >
                <FileText size={12} color="#2563EB" />
                <Text style={styles.weekReceiptBtnText}>Receipt</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Finalized Cycle In-Progress Note */}
        {!selectedWeek.isCurrent && (matchedPastPayout?.status === 'finalized' || (!matchedPastPayout && stats.totalRevenue > 0)) && (
          <View style={styles.finalizedNoticeBox}>
            <ShieldCheck size={16} color="#4338CA" style={{ marginRight: 8, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.finalizedNoticeTitle}>Cycle Finalized • Bank Transfer in Progress</Text>
              <Text style={styles.finalizedNoticeText}>
                Your earnings for {selectedWeek.label} are audited and locked. FlashFits finance team is processing the bank transfer. You will receive an official receipt once credited.
              </Text>
            </View>
          </View>
        )}

        {/* ── DAILY EARNINGS BAR GRAPH ── */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Daily Breakdown (Mon - Sun)</Text>

          {weekLoading ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="small" color="#1A1A1A" />
            </View>
          ) : (
            <View style={styles.barContainer}>
              {dailyBreakdown.map((item, idx) => {
                const barHeight = Math.max((item.amount / maxDailyAmount) * 100, 4);
                const hasValue = item.amount > 0;

                return (
                  <View key={idx} style={styles.barCol}>
                    <Text style={styles.barAmtText} numberOfLines={1}>
                      {item.amount >= 1000 ? `${(item.amount / 1000).toFixed(1)}k` : item.amount > 0 ? item.amount : '-'}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${barHeight}%`,
                            backgroundColor: hasValue ? '#10B981' : '#E2E8F0',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barDayText, hasValue && { fontWeight: '800', color: '#0F172A' }]}>
                      {item.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── METRICS GRID FOR THIS SELECTED WEEK ── */}
        <View style={styles.metricGrid}>
          <View style={styles.metricBox}>
            <View style={styles.metricIconWrap}>
              <TrendingUp size={16} color="#10B981" />
            </View>
            <Text style={styles.metricBoxLabel}>Gross Revenue</Text>
            <Text style={styles.metricBoxVal}>₹{stats.totalRevenue.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.metricBox}>
            <View style={styles.metricIconWrap}>
              <Package size={16} color="#3B82F6" />
            </View>
            <Text style={styles.metricBoxLabel}>Orders Delivered</Text>
            <Text style={styles.metricBoxVal}>{stats.deliveredOrders} Orders</Text>
          </View>

          <View style={styles.metricBox}>
            <View style={styles.metricIconWrap}>
              <DollarSign size={16} color="#8B5CF6" />
            </View>
            <Text style={styles.metricBoxLabel}>Avg Order Value</Text>
            <Text style={styles.metricBoxVal}>₹{Math.round(stats.avgOrderValue)}</Text>
          </View>

          <View style={styles.metricBox}>
            <View style={styles.metricIconWrap}>
              <RotateCcw size={16} color="#EF4444" />
            </View>
            <Text style={styles.metricBoxLabel}>Return Rate</Text>
            <Text style={styles.metricBoxVal}>{stats.returnRate.toFixed(1)}%</Text>
          </View>
        </View>
      </View>

      {/* ── DEDICATED PAYOUTS SCREEN SHORTCUT BANNER ── */}
      <TouchableOpacity
        style={styles.payoutNavBanner}
        onPress={() => router.push('/payouts')}
        activeOpacity={0.8}
      >
        <View style={styles.payoutNavLeft}>
          <View style={styles.payoutNavIconWrap}>
            <DollarSign size={20} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.payoutNavTitle}>Weekly Payouts & Receipts</Text>
            <Text style={styles.payoutNavSub}>View all settlement cycles, bank transfer details & bill receipts</Text>
          </View>
        </View>
        <ChevronRight size={18} color="#64748B" />
      </TouchableOpacity>

      {/* ── SETTLEMENT AUDIT & PAYOUT LOG HISTORY ── */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Payout Log History</Text>
          <Text style={styles.sectionSub}>Weekly automated direct bank settlements</Text>
        </View>
      </View>

      <View style={styles.historyList}>
        {payouts.length === 0 ? (
          <View style={styles.emptyHistoryBox}>
            <CreditCard size={36} color="#94A3B8" />
            <Text style={styles.emptyHistoryTitle}>No Previous Payouts Yet</Text>
            <Text style={styles.emptyHistorySub}>
              Completed orders accumulate each week and settle automatically every Tuesday.
            </Text>
          </View>
        ) : (
          payouts.map((item) => {
            const isExpanded = expandedPayoutId === item._id;
            const badge = getPayoutStatusBadge(item.status);
            const BadgeIcon = badge.icon;

            const displayAmount = item.finalAmount ?? item.netPayout ?? item.amount ?? 0;
            const hasDeductions = (item.totalDeductions && item.totalDeductions > 0) || (item.adminDeduction && item.adminDeduction.amount > 0);

            let weekLabel = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            if (item.weekStart && item.weekEnd) {
              const start = new Date(item.weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' });
              const end = new Date(item.weekEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              weekLabel = `${start} - ${end}`;
            }

            return (
              <TouchableOpacity
                key={item._id}
                style={styles.payoutCard}
                onPress={() => setExpandedPayoutId(isExpanded ? null : item._id)}
                activeOpacity={0.8}
              >
                <View style={styles.payoutCardTop}>
                  <View style={styles.payoutCardLeft}>
                    <View style={styles.payoutIconCircle}>
                      <DollarSign size={18} color="#0F172A" />
                    </View>
                    <View>
                      <Text style={styles.payoutWeekTitle}>Weekly Payout Settlement</Text>
                      <Text style={styles.payoutDateRange}>{weekLabel}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.payoutAmountText}>₹{displayAmount.toLocaleString('en-IN')}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg, marginTop: 4 }]}>
                      <BadgeIcon size={10} color={badge.text} style={{ marginRight: 3 }} />
                      <Text style={[styles.statusBadgeText, { color: badge.text, fontSize: 10 }]}>{badge.label}</Text>
                    </View>
                  </View>
                </View>

                {/* Expandable Breakdown Drawer */}
                {isExpanded && (
                  <View style={styles.payoutExpandedBox}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Gross Product Earnings</Text>
                      <Text style={styles.breakdownValue}>
                        ₹{(item.totalEarnings ?? displayAmount).toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {item.totalDeductions !== undefined && item.totalDeductions > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: '#EF4444' }]}>Commission / Platform Fees</Text>
                        <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>
                          -₹{item.totalDeductions.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}

                    {item.adminDeduction && item.adminDeduction.amount > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: '#EF4444' }]}>
                          Penalty ({item.adminDeduction.reason || 'Damage adjustment'})
                        </Text>
                        <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>
                          -₹{item.adminDeduction.amount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}

                    <View style={styles.breakdownDivider} />

                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { fontWeight: '800', color: '#0F172A' }]}>Net Settlement Transferred</Text>
                      <Text style={[styles.breakdownValue, { fontWeight: '900', color: '#16A34A', fontSize: 15 }]}>
                        ₹{displayAmount.toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {item.referenceNumber && (
                      <View style={styles.utrBadgeBox}>
                        <CreditCard size={12} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={styles.utrText}>Bank Ref / UTR: {item.referenceNumber}</Text>
                      </View>
                    )}

                    {item.receipt?.url && (
                      <TouchableOpacity
                        style={styles.historyReceiptBtn}
                        onPress={() => {
                          setActiveReceiptUrl(item.receipt!.url!);
                          setActiveReceiptTitle(`Payment Receipt (${weekLabel})`);
                          setReceiptModalVisible(true);
                        }}
                      >
                        <FileText size={13} color="#2563EB" />
                        <Text style={styles.historyReceiptBtnText}>View Payment Receipt / Bill Proof</Text>
                        <ExternalLink size={12} color="#2563EB" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.payoutCardFooter}>
                  <Text style={styles.expandHintText}>{isExpanded ? 'Hide breakdown' : 'Tap to view itemized breakdown'}</Text>
                  {isExpanded ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* ── MODAL: PAST WEEKS PICKER ── */}
      <Modal
        visible={weekModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWeekModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Weekly Cycle</Text>
                <Text style={styles.modalSub}>View historical earnings and payout details</Text>
              </View>
              <TouchableOpacity onPress={() => setWeekModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {pastWeeks.map((w, index) => {
                const isSelected = selectedWeek.value === w.value;
                return (
                  <TouchableOpacity
                    key={w.value}
                    style={[styles.weekOptionRow, isSelected && styles.weekOptionRowActive]}
                    onPress={() => handleSelectWeek(w)}
                  >
                    <View>
                      <Text style={[styles.weekOptionLabel, isSelected && styles.weekOptionLabelActive]}>
                        {w.isCurrent ? 'This Week (Current Active)' : `Week ${12 - index}`}
                      </Text>
                      <Text style={styles.weekOptionDates}>{w.label}</Text>
                    </View>
                    {isSelected && <CheckCircle2 size={18} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: RECEIPT VIEWER ── */}
      <Modal
        visible={receiptModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.receiptModalBackdrop}>
          <View style={styles.receiptModalCard}>
            <View style={styles.receiptModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.receiptModalTitle}>{activeReceiptTitle}</Text>
                <Text style={styles.receiptModalSub}>FlashFits Official Transfer Confirmation</Text>
              </View>
              <TouchableOpacity
                onPress={() => setReceiptModalVisible(false)}
                style={styles.receiptModalCloseBtn}
              >
                <X size={20} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <View style={styles.receiptModalImageWrap}>
              {activeReceiptUrl ? (
                <Image
                  source={{ uri: activeReceiptUrl }}
                  style={styles.receiptModalImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <View style={styles.receiptModalFooter}>
              <TouchableOpacity
                style={styles.receiptModalDoneBtn}
                onPress={() => setReceiptModalVisible(false)}
              >
                <Text style={styles.receiptModalDoneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
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
    padding: 22,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 6,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  heroBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 18,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMetaCol: {
    flex: 1,
  },
  heroMetaLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroMetaValue: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },

  // Headers & Selectors
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  weekPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  weekPickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  // Quick Tabs
  quickWeekTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickWeekTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  quickWeekTabActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  quickWeekTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  quickWeekTabTextActive: {
    color: '#FFFFFF',
  },

  // Week Summary Card
  weekSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  weekSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  weekSummaryLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekSummaryAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  commissionSplitBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  commissionSplitText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  paidNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
  },
  paidNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },

  // Chart section
  chartSection: {
    marginTop: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  chartLoading: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barAmtText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 75,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barDayText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 6,
  },

  // Metric grid
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  metricBox: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricIconWrap: {
    marginBottom: 6,
  },
  metricBoxLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricBoxVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },

  // History Payout Cards
  historyList: {
    gap: 12,
  },
  emptyHistoryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptyHistorySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  payoutCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payoutIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutWeekTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  payoutDateRange: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  payoutAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  payoutExpandedBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  utrBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  utrText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  payoutCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  expandHintText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  weekOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  weekOptionRowActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  weekOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekOptionLabelActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  weekOptionDates: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  // Payout Navigation Banner
  payoutNavBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  payoutNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  payoutNavIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutNavTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  payoutNavSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  // Finalized Cycle Notice
  finalizedNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 10,
    alignItems: 'flex-start',
  },
  finalizedNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730A3',
  },
  finalizedNoticeText: {
    fontSize: 11,
    color: '#4338CA',
    marginTop: 2,
    lineHeight: 15,
  },
  // Week Card Receipt Button
  weekReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  weekReceiptBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  // History Item Receipt Button
  historyReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  historyReceiptBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  // Receipt Modal Styles
  receiptModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  receiptModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  receiptModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  receiptModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  receiptModalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  receiptModalCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  receiptModalImageWrap: {
    backgroundColor: '#0F172A',
    minHeight: 320,
    maxHeight: 460,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  receiptModalImage: {
    width: '100%',
    height: '100%',
  },
  receiptModalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  receiptModalDoneBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  receiptModalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
