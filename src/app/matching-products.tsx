import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api, { updateMatchingProducts, resolveImageUrl } from '../utils/api';
import { Check, X, Image as ImageIcon } from 'lucide-react-native';

interface Product {
  id: string;
  _id?: string;
  styleGroupId?: string;
  name: string;
  images?: (string | { url: string })[];
  variants?: any[];
}

export default function MatchingProductsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { merchant } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  useEffect(() => {
    if (!id || !merchant) return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch current product to prepopulate selected
        const prodRes = await api.get(`/merchant/getBaseProductById/${id}`);
        const prod = prodRes.data?.product || prodRes.data || {};
        if (prod.matchingProducts && Array.isArray(prod.matchingProducts)) {
          setSelectedProducts(prod.matchingProducts);
        }

        // 2. Fetch all merchant products
        const mId = merchant._id || merchant.id;
        const res = await api.get(`/merchant/fetchProductsByMerchantId/${mId}`);
        const rawList = Array.isArray(res.data) ? res.data : (res.data?.products || []);
        
        const productList: Product[] = rawList.map((p: any, pIdx: number) => {
          const pId = p._id || p.id || `prod_${pIdx}`;
          return {
            id: pId,
            _id: p._id || pId,
            styleGroupId: p.styleGroupId || pId,
            name: p.name || 'Unnamed Product',
            images: p.images || [],
            variants: p.variants || [],
          };
        });
        
        // Filter out the current product itself
        const filtered = productList.filter(p => p.styleGroupId !== prod.styleGroupId && p.styleGroupId !== id);
        setProducts(filtered);

      } catch (err: any) {
        if (err?.response?.status === 404) {
          setProducts([]);
        } else {
          console.error('Failed to load products:', err);
          Alert.alert('Error', 'Failed to retrieve products for matching.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id, merchant]);

  const handleToggle = (styleGroupId: string) => {
    if (!styleGroupId) return;
    
    if (selectedProducts.includes(styleGroupId)) {
      setSelectedProducts(selectedProducts.filter(item => item !== styleGroupId));
    } else {
      if (selectedProducts.length >= 3) {
        Alert.alert('Limit Reached', 'You can only select up to 3 matching products.');
        return;
      }
      setSelectedProducts([...selectedProducts, styleGroupId]);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    
    try {
      setSaving(true);
      await updateMatchingProducts(id as string, selectedProducts);
      Alert.alert('Success', 'Matching products updated successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update matching products.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E293B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <X size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Select Matching Products</Text>
          <Text style={styles.headerSub}>Choose up to 3 products</Text>
        </View>
        <TouchableOpacity 
          style={[styles.saveBtn, saving && styles.disabledBtn]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {products.length === 0 ? (
          <Text style={styles.emptyText}>No other products found.</Text>
        ) : (
          products.map((p) => {
            const sgId = p.styleGroupId || p.id;
            const isSelected = selectedProducts.includes(sgId);
            
            // Get cover image
            const coverImageObj = p.images?.[0] || p.variants?.[0]?.images?.[0];
            const coverImageUri = resolveImageUrl(
              typeof coverImageObj === 'string' ? coverImageObj : coverImageObj?.url
            );

            return (
              <TouchableOpacity 
                key={p.id} 
                style={[styles.productCard, isSelected && styles.productCardSelected]}
                onPress={() => handleToggle(sgId)}
                activeOpacity={0.7}
              >
                <View style={styles.imageContainer}>
                  {coverImageUri ? (
                    <Image source={{ uri: coverImageUri }} style={styles.image} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <ImageIcon size={24} color="#94A3B8" />
                    </View>
                  )}
                </View>
                
                <View style={styles.infoContainer}>
                  <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.productIdText}>ID: {sgId}</Text>
                </View>
                
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Check size={16} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748B',
    fontSize: 16,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productIdText: {
    fontSize: 12,
    color: '#64748B',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
});
