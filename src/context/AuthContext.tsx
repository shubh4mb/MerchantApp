import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../utils/api';

interface Merchant {
  id: string;
  _id?: string;
  shopName: string;
  email: string;
  ownerName?: string;
  phoneNumber?: string;
  isOnline: boolean;
  isActive: boolean;
  status?: string;
  rejectionReason?: string;
  logo?: { public_id?: string; url?: string };
  backgroundImage?: { public_id?: string; url?: string };
  accountType?: string;
  warehouseId?: string;
}

interface AuthContextType {
  merchant: Merchant | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Merchant>;
  setAuthSession: (merchant: any, token: string, refreshToken?: string) => Promise<Merchant>;
  logout: () => Promise<void>;
  updateMerchantState: (updates: Partial<Merchant>) => void;
  checkAuthSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set authenticated session with token and merchant details
  const setAuthSession = async (
    receivedMerchant: any,
    receivedToken: string,
    receivedRefreshToken?: string
  ): Promise<Merchant> => {
    const merchantData: Merchant = {
      id: String(receivedMerchant.id || receivedMerchant._id || ''),
      _id: String(receivedMerchant._id || receivedMerchant.id || ''),
      shopName: receivedMerchant.shopName || '',
      email: receivedMerchant.email || '',
      ownerName: receivedMerchant.ownerName || '',
      phoneNumber: receivedMerchant.phoneNumber || '',
      isOnline: !!receivedMerchant.isOnline,
      isActive: !!receivedMerchant.isActive,
      status: receivedMerchant.status || 'incomplete',
      rejectionReason: receivedMerchant.rejectionReason,
      logo: receivedMerchant.logo,
      backgroundImage: receivedMerchant.backgroundImage,
      accountType: receivedMerchant.accountType,
      warehouseId: receivedMerchant.warehouseId,
    };

    // Store in SecureStore for persistence
    await SecureStore.setItemAsync('token', receivedToken);
    if (receivedRefreshToken) {
      await SecureStore.setItemAsync('refreshToken', receivedRefreshToken);
    }
    await SecureStore.setItemAsync('merchant', JSON.stringify(merchantData));

    // Update state
    setToken(receivedToken);
    setMerchant(merchantData);
    return merchantData;
  };

  // Check SecureStore for existing credentials on app launch
  const checkAuthSession = async () => {
    try {
      const savedToken = await SecureStore.getItemAsync('token');
      const savedMerchant = await SecureStore.getItemAsync('merchant');

      if (savedToken) {
        setToken(savedToken);
        
        // Attempt to sync the latest merchant status from backend
        try {
          const profileRes = await api.get('merchant/getMerchant');
          // Response has { merchant } or is flattened
          const receivedMerchant = profileRes.data?.merchant || profileRes.data;
          
          if (receivedMerchant) {
            const merchantData: Merchant = {
              id: String(receivedMerchant.id || receivedMerchant._id || ''),
              _id: String(receivedMerchant._id || receivedMerchant.id || ''),
              shopName: receivedMerchant.shopName || '',
              email: receivedMerchant.email || '',
              ownerName: receivedMerchant.ownerName || '',
              phoneNumber: receivedMerchant.phoneNumber || '',
              isOnline: !!receivedMerchant.isOnline,
              isActive: !!receivedMerchant.isActive,
              status: receivedMerchant.status || 'incomplete',
              rejectionReason: receivedMerchant.rejectionReason,
              logo: receivedMerchant.logo,
              backgroundImage: receivedMerchant.backgroundImage,
              accountType: receivedMerchant.accountType,
              warehouseId: receivedMerchant.warehouseId,
            };
            await SecureStore.setItemAsync('merchant', JSON.stringify(merchantData));
            setMerchant(merchantData);
            return;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch latest merchant profile, falling back to cached session:', fetchErr);
        }

        // Fallback to cached merchant data
        if (savedMerchant) {
          const parsed = JSON.parse(savedMerchant);
          if (!parsed.id && parsed._id) {
            parsed.id = String(parsed._id);
          }
          setMerchant(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load auth session:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthSession();
  }, []);

  const login = async (email: string, password: string): Promise<Merchant> => {
    try {
      setLoading(true);
      const response = await api.post('merchant/login', {
        identifier: email,
        password,
      });

      // Response contains { token, refreshToken, merchant }
      const { token: receivedToken, refreshToken: receivedRefreshToken, merchant: receivedMerchant } = response.data;

      if (!receivedToken || !receivedMerchant) {
        throw new Error('Invalid login response from server');
      }

      return await setAuthSession(receivedMerchant, receivedToken, receivedRefreshToken);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      try {
        await api.post('/merchant/auth/logout').catch(() => {});
      } catch {}
      delete api.defaults.headers.common['Authorization'];
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('merchant');
      setMerchant(null);
      setToken(null);
    } catch (e) {
      console.error('Failed to logout cleanly:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateMerchantState = (updates: Partial<Merchant>) => {
    setMerchant((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      SecureStore.setItemAsync('merchant', JSON.stringify(updated)).catch((err) =>
        console.error('Failed to sync updated merchant to storage:', err)
      );
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        merchant,
        token,
        loading,
        login,
        setAuthSession,
        logout,
        updateMerchantState,
        checkAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
