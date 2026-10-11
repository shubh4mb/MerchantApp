import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import api from '@/utils/api';
import { Clock, LogOut, RefreshCw } from 'lucide-react-native';

export default function PendingVerificationScreen() {
  const router = useRouter();
  const { logout, updateMerchantState, merchant } = useAuth();
  const [checking, setChecking] = useState(false);
  const isPaymentPending = merchant?.status === 'payment_pending_verification';

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const response = await api.get('merchant/getMerchant');
      const data = response.data?.merchant;
      if (data) {
        // Update local context
        updateMerchantState({
          status: data.status,
          isActive: !!data.isActive,
        });

        // Trigger redirect based on updated status
        router.replace('/');
      } else {
        Alert.alert('Status Info', 'Verification is still in progress.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to check verification status.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Clock size={40} color="#3B82F6" />
        </View>

        <Text style={styles.title}>
          {isPaymentPending ? 'Payment Under Review' : 'Under Verification'}
        </Text>
        <Text style={styles.description}>
          {isPaymentPending
            ? 'Your registration fee payment transaction is currently being verified by our administration team.'
            : 'Your documents and shop registration details are currently being reviewed by our administration team.'
          }
        </Text>
        <Text style={styles.subDescription}>
          {isPaymentPending
            ? 'This process usually takes up to a few business hours. Your account dashboard will unlock once activation is complete.'
            : "This process usually takes up to 24–48 business hours. You'll receive an email notification when your account is approved."
          }
        </Text>

        <TouchableOpacity
          style={styles.checkBtn}
          onPress={handleCheckStatus}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.checkBtnText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={18} color="#475569" style={{ marginRight: 8 }} />
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
    backgroundColor: '#EFF6FF',
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
    marginBottom: 8,
  },
  subDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginBottom: 12,
  },
  checkBtnText: {
    color: '#FFFFFF',
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
