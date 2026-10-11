import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Entrypoint() {
  const { merchant, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (merchant) {
      const status = merchant.status;
      const isActive = merchant.isActive;

      if (isActive || status === 'active') {
        router.replace('/(tabs)/orders');
      } else if (status === 'pending_payment') {
        router.replace('/payment');
      } else if (status === 'pending_verification' || status === 'payment_pending_verification') {
        router.replace('/pending-verification');
      } else if (status === 'rejected') {
        router.replace('/rejected');
      } else {
        router.replace('/onboarding');
      }
    } else {
      router.replace('/(auth)/login');
    }
  }, [merchant, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>FF</Text>
        <Text style={styles.logoSubtext}>MERCHANT</Text>
      </View>
      <ActivityIndicator size="large" color="#1A1A1A" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 4,
  },
  logoSubtext: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 6,
    marginTop: -5,
  },
  loader: {
    marginTop: 20,
  },
});
