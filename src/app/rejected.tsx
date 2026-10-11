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
import { XCircle, LogOut, Edit3, RefreshCw, AlertTriangle } from 'lucide-react-native';

export default function RejectedScreen() {
  const router = useRouter();
  const { merchant, logout, updateMerchantState } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const response = await api.get('merchant/getMerchant');
      const data = response.data?.merchant;
      if (data) {
        updateMerchantState({
          status: data.status,
          rejectionReason: data.rejectionReason,
          isActive: !!data.isActive,
        });

        if (data.status !== 'rejected') {
          router.replace('/');
          return;
        } else {
          Alert.alert('Status Info', 'Your application is still in rejected status. Please correct the flagged issues and resubmit.');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to check status.');
    } finally {
      setChecking(false);
    }
  };

  const handleFixDetails = () => {
    router.push('/onboarding');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <XCircle size={44} color="#DC2626" />
        </View>

        <Text style={styles.title}>Action Required</Text>
        <Text style={styles.subtitle}>Registration / Document Review</Text>
        
        {merchant?.rejectionReason ? (
          <View style={styles.reasonCard}>
            <View style={styles.reasonHeader}>
              <AlertTriangle size={16} color="#B91C1C" />
              <Text style={styles.reasonTitle}>Issues Flagged by Admin:</Text>
            </View>
            <Text style={styles.reasonText}>{merchant.rejectionReason}</Text>
          </View>
        ) : (
          <Text style={styles.description}>
            Some details or documents submitted during your registration need correction. Please review and resubmit.
          </Text>
        )}

        <TouchableOpacity style={styles.fixBtn} onPress={handleFixDetails}>
          <Edit3 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.fixBtnText}>Review & Re-upload Documents</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkBtn} onPress={handleCheckStatus} disabled={checking}>
          {checking ? (
            <ActivityIndicator size="small" color="#475569" />
          ) : (
            <>
              <RefreshCw size={16} color="#475569" style={{ marginRight: 8 }} />
              <Text style={styles.checkBtnText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={16} color="#64748B" style={{ marginRight: 6 }} />
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
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 18,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 20,
  },
  reasonCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 22,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  reasonText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
    fontWeight: '500',
  },
  fixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    width: '100%',
    height: 52,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 2,
  },
  fixBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    height: 48,
    borderRadius: 14,
    marginBottom: 14,
  },
  checkBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  logoutBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
