import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <StatusBar style="auto" />
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
        </Stack>
      </SocketProvider>
    </AuthProvider>
  );
}
