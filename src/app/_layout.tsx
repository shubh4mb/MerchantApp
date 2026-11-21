import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { AppUpdateModal } from '@/components/modals/AppUpdateModal';

function RootNavigator() {
  const { merchant, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const {
    updateType,
    isModalVisible,
    versionPolicy,
    currentAppVersion,
    dismissOptionalUpdate,
  } = useAppUpdate();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!merchant && !inAuthGroup) {
      // User signed out or not authenticated, redirect to login
      router.replace('/(auth)/login');
    }
  }, [merchant, loading, segments]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ headerShown: true, headerTitle: 'Onboarding Setup', headerTintColor: '#1A1A1A' }} />
        <Stack.Screen name="payment" options={{ headerShown: false }} />
        <Stack.Screen name="pending-verification" options={{ headerShown: false }} />
        <Stack.Screen name="rejected" options={{ headerShown: false }} />
        <Stack.Screen name="add-product" options={{ headerShown: true, headerTitle: 'Add New Product', headerTintColor: '#1A1A1A' }} />
        <Stack.Screen name="add-variant" options={{ headerShown: true, headerTitle: 'Add Color Variant', headerTintColor: '#1A1A1A' }} />
        <Stack.Screen name="edit-product" options={{ headerShown: true, headerTitle: 'Edit Product Details', headerTintColor: '#1A1A1A' }} />
        <Stack.Screen name="bank-and-documents" options={{ headerShown: true, headerTitle: 'Bank & Verification Details', headerTintColor: '#1A1A1A' }} />
        <Stack.Screen name="policies" options={{ headerShown: false }} />
        <Stack.Screen name="payouts" options={{ headerShown: true, headerTitle: 'Weekly Payouts', headerTintColor: '#1A1A1A' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
      </Stack>

      <AppUpdateModal
        visible={isModalVisible}
        type={updateType}
        currentVersion={currentAppVersion}
        latestVersion={versionPolicy?.latestVersion || '1.0.0'}
        storeUrl={versionPolicy?.storeUrl}
        webUrl={versionPolicy?.webUrl}
        title={updateType === 'MANDATORY' ? versionPolicy?.mandatoryTitle : versionPolicy?.optionalTitle}
        message={updateType === 'MANDATORY' ? versionPolicy?.mandatoryMessage : versionPolicy?.optionalMessage}
        releaseNotes={versionPolicy?.releaseNotes}
        onDismiss={dismissOptionalUpdate}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
