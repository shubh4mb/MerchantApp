import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL, API_BASE_URL, resolveImageUrl, DEFAULT_BACKEND_URL } from '@/constants/config';

// Re-export single source of truth configuration
export { BACKEND_URL, API_BASE_URL, resolveImageUrl, DEFAULT_BACKEND_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Request interceptor to append JWT token
api.interceptors.request.use(
  async (config) => {
    try {
      console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${config.baseURL || ''}${config.url}`);
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['ngrok-skip-browser-warning'] = 'true';
      }
    } catch (error) {
      console.error('Error fetching token from SecureStore:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auto 401 token refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    // Standard response flattening used in the FlashFits backend
    if (response.data?.success !== undefined && response.data?.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url?.includes('login') && 
      !originalRequest.url?.includes('refresh') &&
      !originalRequest.url?.includes('forgot-password') &&
      !originalRequest.url?.includes('reset-password')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Run refresh token endpoint on backend
        const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
        const res = await axios.post(`${API_BASE_URL}/merchant/auth/refresh`, {
          refreshToken: storedRefreshToken
        });
        const { token, refreshToken: newRefreshToken, merchant } = res.data;

        if (token) {
          await SecureStore.setItemAsync('token', token);
          if (newRefreshToken) {
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);
          }
          if (merchant) {
            await SecureStore.setItemAsync('merchant', JSON.stringify(merchant));
          }

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          originalRequest.headers.Authorization = `Bearer ${token}`;

          processQueue(null, token);
          isRefreshing = false;

          return api(originalRequest);
        } else {
          throw new Error('Refresh token invalid');
        }
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;

        // Clear local credentials on authentication expiry
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('merchant');

        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ----------------------------------------------------
// PRODUCT & BRAND API HELPERS
// ----------------------------------------------------
export const getBrands = async (merchantId: string) => {
  const res = await api.get(`/merchant/brand/get?merchantId=${merchantId}`);
  return res.data;
};

export const addBrand = async (formData: FormData) => {
  const res = await api.post('/merchant/brand/add', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const updateStock = async (productId: string, variantId: string, data: any) => {
  const res = await api.patch(
    `/merchant/updateMultipleVariantSizes/${productId}/${variantId}`,
    data
  );
  return res.data;
};

export const updateMatchingProducts = async (productId: string, matchingProducts: string[]) => {
  const res = await api.put(`/merchant/updateMatchingProducts/${productId}`, { matchingProducts });
  return res.data;
};

export const updateSingleSizeStock = async (
  productId: string,
  variantId: string,
  sizeName: string,
  stock: number,
  colorName?: string
) => {
  try {
    const res = await api.patch(
      `/merchant/updateVariantSizeStock/${productId}/${variantId}/${encodeURIComponent(sizeName)}`,
      { stock }
    );
    return res.data;
  } catch (err1) {
    try {
      const res = await api.patch(
        `/merchant/updateMultipleVariantSizes/${productId}/${variantId}`,
        { sizes: [{ size: sizeName, stock }] }
      );
      return res.data;
    } catch (err2) {
      const res = await api.put(
        `/merchant/updateStock/${productId}/${variantId}/${encodeURIComponent(sizeName)}`,
        { stock }
      );
      return res.data;
    }
  }
};

export const deleteProduct = async (productId: string) => {
  const res = await api.delete(`/merchant/deleteProduct/${productId}`);
  return res.data;
};

export const deleteProductVariant = async (productId: string, variantId: string) => {
  const res = await api.delete(`/merchant/deleteVariant/${productId}/${variantId}`);
  return res.data;
};

export const deleteSize = async (productId: string, variantId: string, sizeId: string) => {
  const res = await api.delete(`/merchant/deleteSizes/${productId}/${variantId}/${sizeId}`);
  return res.data;
};

export const createProductFull = async (formData: FormData) => {
  const res = await api.post('/merchant/createProductFull', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const analyzeProductWithAi = async (data: FormData | { image: string; mimeType?: string }) => {
  const isFormData =
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    Boolean(data && typeof (data as any).append === 'function');

  const res = await api.post('/merchant/products/ai-analyze', data, {
    headers: {
      'Content-Type': isFormData ? 'multipart/form-data' : 'application/json',
    },
    timeout: 60000,
  });
  return res.data?.data ?? res.data;
};

export const fetchMyConsignedWarehouseStock = async () => {
  const res = await api.get('/merchant/my-consigned-stock');
  return res.data;
};

export const applyForWarehouseService = async () => {
  const res = await api.post('/merchant/apply-warehouse');
  return res.data;
};

// ----------------------------------------------------
// ORDER & PACKING PROOF API HELPERS
// ----------------------------------------------------
export const packOrder = async (orderId: string) => {
  const res = await api.post(`/merchant/order/packed/${orderId}`);
  return res.data;
};

export const markItemOutOfStock = async (orderId: string, itemId: string, reason?: string) => {
  const res = await api.post(`/merchant/order/${orderId}/item-out-of-stock`, {
    itemId,
    reason: reason || 'Item out of stock at store',
  });
  return res.data;
};

export const getPackingPhotos = async (orderId: string) => {
  const res = await api.get(`/merchant/order/${orderId}/packing-photos`);
  return res.data;
};

export const uploadPackingPhoto = async (orderId: string, itemId: string, fileData: any) => {
  const formData = new FormData();
  formData.append('image', fileData);
  formData.append('orderId', orderId);
  formData.append('itemId', itemId);

  const res = await api.post(`/merchant/order/packing-photos/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deletePackingPhoto = async (orderId: string, photoId: string) => {
  const res = await api.delete(`/merchant/order/${orderId}/packing-photos/${photoId}`);
  return res.data;
};

export const getCourierOrders = async () => {
  const res = await api.get('/merchant/courier/getAllOrders');
  return res.data.orders || res.data;
};

export const updateCourierOrderStatus = async (orderId: string, status: string) => {
  const res = await api.patch(`/merchant/courier/order/${orderId}/status`, { status });
  return res.data;
};

// ----------------------------------------------------
// OFFERS & PROMOTIONS API HELPERS
// ----------------------------------------------------
export const getMyOffers = async (isActive?: boolean) => {
  const params: any = {};
  if (isActive !== undefined) params.isActive = isActive;
  const res = await api.get('/merchant/offers', { params });
  return res.data?.offers || res.data;
};

export const createOffer = async (data: any) => {
  const res = await api.post('/merchant/offers', data);
  return res.data?.offer || res.data;
};

export const updateOffer = async (id: string, data: any) => {
  const res = await api.put(`/merchant/offers/${id}`, data);
  return res.data?.offer || res.data;
};

export const toggleOffer = async (id: string) => {
  const res = await api.patch(`/merchant/offers/${id}/toggle`);
  return res.data?.offer || res.data;
};

export const deleteOffer = async (id: string) => {
  const res = await api.delete(`/merchant/offers/${id}`);
  return res.data;
};

// ----------------------------------------------------
// ZIP COVERS (PACKAGING MATERIAL) API HELPERS
// ----------------------------------------------------
export const createZipCoverOrder = async (small: number, medium: number, large: number) => {
  const res = await api.post('/merchant/zip-covers/order', { small, medium, large });
  return res.data?.order || res.data;
};

export const getMyZipCoverOrders = async () => {
  const res = await api.get('/merchant/zip-covers');
  return res.data?.orders || res.data;
};

// ----------------------------------------------------
// ANALYTICS & REVENUE API HELPERS
// ----------------------------------------------------
export const getMerchantAnalytics = async (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const res = await api.get(`/merchant/analytics?${params.toString()}`);
  return res.data;
};

export const getMerchantWallet = async () => {
  const res = await api.get('/merchant/wallet');
  return res.data;
};

export const getMerchantCurrentWeek = async () => {
  const res = await api.get('/merchant/earnings/current-week');
  return res.data;
};

export const getMerchantPayoutHistory = async (page = 1, limit = 10) => {
  const res = await api.get(`/merchant/earnings/history?page=${page}&limit=${limit}`);
  return res.data;
};

export default api;

