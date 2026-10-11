import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import api, { BACKEND_URL } from '@/utils/api';
import { CreditCard, LogOut, ExternalLink, RefreshCw } from 'lucide-react-native';

export default function PaymentScreen() {
  const router = useRouter();
  const { merchant, logout, updateMerchantState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feeDetails, setFeeDetails] = useState<any>(null);

  const fetchPaymentOrder = async () => {
    if (!merchant) return;
    setLoading(true);
    try {
      const response = await api.get('merchant/registration-fee/amount');
      // Store in paise to keep compatibility with existing UI that divides by 100
      setFeeDetails({ amount: response.data.feeAmount * 100 });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to load payment fee details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentOrder();
  }, []);

  const handleOpenWebPayment = async () => {
    if (feeDetails?.amount === 0) {
      setLoading(true);
      try {
        if (!merchant?.id) return;
        const response = await api.post(`merchant/${merchant.id}/registration-fee/create-order`);
        if (response.data?.status === 'active') {
          Alert.alert('Activated', 'Registration fee is waived. Your account is active.', [
            {
              text: 'OK',
              onPress: () => {
                updateMerchantState({ status: 'active', isActive: true });
                router.replace('/');
              },
            },
          ]);
        }
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to activate account.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Open the web portal payment screen.
    const backendUrl = BACKEND_URL;
    let webPortalUrl = 'https://merchant.flashfits.com/merchant/payment';
    
    if (backendUrl.includes('localhost') || backendUrl.includes('192.168.')) {
      // Development local IP mapping
      const ip = backendUrl.match(/\d+\.\d+\.\d+\.\d+/)?.[0] || 'localhost';
      webPortalUrl = `http://${ip}:5173/merchant/payment`; // typical vite merchant port
    }

    Linking.openURL(webPortalUrl).catch(() => {
      Alert.alert('Notice', 'Please visit the FlashFits Merchant Web Dashboard on your computer to complete the registration fee payment.');
    });
  };

  const handleCheckPaymentStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get('merchant/getMerchant');
      const latestMerchant = response.data?.merchant;
      if (latestMerchant) {
        updateMerchantState({
          status: latestMerchant.status,
          isActive: !!latestMerchant.isActive,
        });

        if (latestMerchant.status === 'active') {
          Alert.alert('Success', 'Payment verified! Your account is now active.', [
            { text: 'Let\'s Go', onPress: () => router.replace('/') }
          ]);
        } else {
          Alert.alert('Payment Status', 'We haven\'t received your payment yet. If you just paid, please wait a minute and check again.');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to check status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <CreditCard size={40} color="#10B981" />
        </View>

        <Text style={styles.title}>Registration Fee</Text>
        <Text style={styles.description}>
          Your documents have been verified successfully! To start listing products and accepting orders, please complete the one-time registration fee payment.
        </Text>

        {loading && !feeDetails ? (
          <ActivityIndicator color="#1A1A1A" style={{ marginVertical: 20 }} />
        ) : feeDetails ? (
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount Due</Text>
            {feeDetails.amount === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.amountText, { textDecorationLine: 'line-through', color: '#94A3B8', marginRight: 8, fontSize: 24 }]}>
                  ₹3000
                </Text>
                <Text style={styles.amountText}>
                  ₹0
                </Text>
              </View>
            ) : (
              <Text style={styles.amountText}>
                ₹{(feeDetails.amount / 100).toFixed(2)}
              </Text>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.payBtn}
          onPress={handleOpenWebPayment}
          disabled={loading}
        >
          {feeDetails?.amount === 0 ? null : <ExternalLink size={18} color="#FFFFFF" style={{ marginRight: 8 }} />}
          <Text style={styles.payBtnText}>{feeDetails?.amount === 0 ? "Activate Account" : "Pay via Web Browser"}</Text>
        </TouchableOpacity>

        {feeDetails?.amount !== 0 && (
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={handleCheckPaymentStatus}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <>
                <RefreshCw size={16} color="#1A1A1A" style={{ marginRight: 8 }} />
                <Text style={styles.checkBtnText}>I've Paid, Check Status</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={16} color="#475569" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  amountContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#10B981',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginBottom: 12,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginBottom: 12,
  },
  checkBtnText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    width: '100%',
    height: 52,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
});
