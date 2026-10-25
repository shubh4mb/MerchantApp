import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { useRouter } from 'expo-router';
import { 
  BarChart, 
  Package, 
  PackageCheck,
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Award,
  DollarSign,
  ChevronRight
} from 'lucide-react-native';

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  avgOrderValue: number;
  returnRate: number;
  deliveryRate: number;
}

interface TopProduct {
  _id: string;
  name: string;
  soldQuantity: number;
  revenue: number;
}

interface Transaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
  orderId?: string;
  _id: string;
}

export default function DashboardScreen() {
  const { merchant, checkAuthSession } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // States for Analytics & Wallet
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
    avgOrderValue: 0,
    returnRate: 0,
    deliveryRate: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [pendingPayout, setPendingPayout] = useState(0);

  const loadDashboardData = async () => {
    try {
      if (!merchant?.id) return;

      // Ensure merchant online status and profile are up to date directly from DB
      checkAuthSession().catch((err) =>
        console.warn('Silent refresh of merchant session failed:', err)
      );
      
      // Fetch Analytics
      const analyticsRes = await api.get('/merchant/analytics');
      if (analyticsRes.data) {
        setStats(analyticsRes.data.stats || stats);
        setTopProducts(analyticsRes.data.topProducts || []);
      }


      // Fetch Current Week Earnings
      const currentWeekRes = await api.get('/merchant/earnings/current-week').catch(() => null);
      if (currentWeekRes?.data?.success && currentWeekRes.data.payout) {
        setPendingPayout(currentWeekRes.data.payout.netPayout || 0);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [merchant?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>Loading Dashboard Stats...</Text>
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
      {/* Welcome Banner */}
      <View style={styles.welcomeBanner}>
        <View>
          <Text style={styles.welcomeSubtitle}>Store Status Overview</Text>
          <Text style={styles.welcomeTitle}>{merchant?.shopName || 'My Store'}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.liveIndicator,
            !merchant?.isOnline && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }
          ]}
          onPress={() => router.push('/(tabs)/profile' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.liveDot, !merchant?.isOnline && { backgroundColor: '#94A3B8' }]} />
          <Text style={[styles.liveText, !merchant?.isOnline && { color: '#64748B' }]}>
            {merchant?.isOnline ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Earnings Card */}
      {/* Pending Payout Card */}
      <TouchableOpacity
        style={styles.walletCard}
        onPress={() => router.push('/payouts')}
        activeOpacity={0.85}
      >
        <View style={styles.walletHeader}>
          <View style={styles.walletIconBg}>
            <DollarSign size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.walletLabel}>This Week's Projected Payout</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginRight: 2 }}>Payouts</Text>
              <ChevronRight size={12} color="#FFFFFF" />
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' }}>
          <View>
            <Text style={styles.walletBalance}>₹{pendingPayout.toFixed(2)}</Text>
          </View>
        </View>
        <Text style={styles.walletFooter}>*Tap to view weekly settlement history & official receipts</Text>
      </TouchableOpacity>

      {/* Promotions Quick Banner */}
      <TouchableOpacity
        style={styles.promoActionBanner}
        onPress={() => router.push('/offers')}
      >
        <View style={styles.promoBannerLeft}>
          <View style={styles.promoIconBg}>
            <Award size={18} color="#1A1A1A" />
          </View>
          <View>
            <Text style={styles.promoActionTitle}>Coupons & Promotions</Text>
            <Text style={styles.promoActionDesc}>Create custom codes to boost sales</Text>
          </View>
        </View>
        <ChevronRight size={18} color="#94A3B8" />
      </TouchableOpacity>

      {/* Analytics Grid */}
      <Text style={styles.sectionHeader}>Key Performance Metrics</Text>
      <View style={styles.gridContainer}>
        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#E0F2FE' }]}>
              <DollarSign size={18} color="#0284C7" />
            </View>
            <Text style={styles.metricLabel}>Total Revenue</Text>
            <Text style={styles.metricValue}>₹{stats.totalRevenue.toFixed(0)}</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#DCFCE7' }]}>
              <PackageCheck size={18} color="#15803D" />
            </View>
            <Text style={styles.metricLabel}>Delivered</Text>
            <Text style={styles.metricValue}>{stats.deliveredOrders}</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Clock size={18} color="#B45309" />
            </View>
            <Text style={styles.metricLabel}>Pending</Text>
            <Text style={styles.metricValue}>{stats.pendingOrders}</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconBg, { backgroundColor: '#FEE2E2' }]}>
              <TrendingDown size={18} color="#B91C1C" />
            </View>
            <Text style={styles.metricLabel}>Return Rate</Text>
            <Text style={styles.metricValue}>{stats.returnRate.toFixed(1)}%</Text>
          </View>
        </View>
      </View>

      {/* Top Selling Products */}
      <Text style={styles.sectionHeader}>Top Selling Products</Text>
      <View style={styles.cardContainer}>
        {topProducts.length > 0 ? (
          topProducts.map((item, idx) => (
            <View key={item._id || idx} style={styles.topProductItem}>
              <View style={styles.productBadge}>
                <Award size={16} color="#475569" />
              </View>
              <View style={styles.productDetails}>
                <Text style={styles.productName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.productSold}>
                  {item.soldQuantity} units sold
                </Text>
              </View>
              <Text style={styles.productRevenue}>₹{item.revenue}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No sales metrics available for top products yet.</Text>
        )}
      </View>


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
  welcomeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#388E3C',
  },
  walletCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletIconBg: {
    backgroundColor: '#333333',
    padding: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  walletLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  walletBalance: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  walletSubLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  walletFooter: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  gridContainer: {
    marginBottom: 16,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  metricIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
    marginTop: 4,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 24,
  },
  topProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  productSold: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  productRevenue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 24,
    fontStyle: 'italic',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  txSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  txIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txDescription: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  txDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  promoActionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 24,
  },
  promoBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoIconBg: {
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 10,
  },
  promoActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  promoActionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
