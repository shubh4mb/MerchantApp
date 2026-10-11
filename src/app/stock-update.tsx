import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api, { updateSingleSizeStock, updateStock } from '../utils/api';
import { Search, Save, RefreshCw, ChevronDown, ChevronUp, Package, Edit3 } from 'lucide-react-native';

interface SizeStock {
  _id?: string;
  size: string;
  sizeCode?: string;
  stock: number;
}

interface Variant {
  _id: string;
  colorName?: string;
  colorHex?: string;
  images?: (string | { url: string })[];
  sizes: SizeStock[];
}

interface Product {
  _id: string;
  name?: string;
  title?: string;
  variants: Variant[];
}

export default function StockQuickUpdateScreen() {
  const { merchant } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchProducts = async () => {
    if (!merchant?._id && !merchant?.id) return;
    const mId = merchant._id || merchant.id;
    try {
      const res = await api.get(`/merchant/fetchProductsByMerchantId/${mId}`);
      const list = res.data?.products || res.data || [];
      setProducts(list);
      setFilteredProducts(list);

      // Initialize local stock inputs map
      const initialStockMap: Record<string, number> = {};
      list.forEach((prod: Product) => {
        prod.variants?.forEach((varItem) => {
          varItem.sizes?.forEach((sz) => {
            if (sz._id) {
              initialStockMap[`${prod._id}_${varItem._id}_${sz._id}`] = sz.stock || 0;
            }
          });
        });
      });
      setStockInputs(initialStockMap);
    } catch (err) {
      console.error('Failed to load products for stock update:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [merchant]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = products.filter((p) => {
      const pName = (p.name || p.title || '').toLowerCase();
      const matchVariant = p.variants?.some((v) =>
        (v.colorName || '').toLowerCase().includes(query) ||
        v.sizes?.some((s) => s.size.toLowerCase().includes(query) || (s.sizeCode || '').toLowerCase().includes(query))
      );
      return pName.includes(query) || matchVariant;
    });
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const handleStockChange = (key: string, value: string) => {
    const parsed = parseInt(value, 10);
    setStockInputs((prev) => ({
      ...prev,
      [key]: isNaN(parsed) ? 0 : parsed,
    }));
  };

  const handleSaveStock = async (productId: string, variantId: string, sizeName: string, sizeId: string) => {
    const key = `${productId}_${variantId}_${sizeId}`;
    const newStock = stockInputs[key];
    if (newStock === undefined) return;

    setSavingKey(key);
    try {
      await updateSingleSizeStock(productId, variantId, sizeName, newStock);
      Alert.alert('Updated', 'Stock updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update stock.');
    } finally {
      setSavingKey(null);
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const isExpanded = !!expandedProducts[item._id];
    const brandName = typeof (item as any).brand === 'object' ? (item as any).brand?.name : (item as any).brand;
    const productTitle = brandName || (item as any).productCode || (item as any).styleGroupId || 'Product';

    return (
      <View style={styles.productCard}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item._id)}>
          <View style={styles.headerTitleRow}>
            <Package size={20} color="#1E293B" style={{ marginRight: 8 }} />
            <Text style={styles.productTitle} numberOfLines={1}>
              {productTitle}
            </Text>
          </View>
          {isExpanded ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardContent}>
            {item.variants?.map((v) => {
              const imageUri = typeof v.images?.[0] === 'string' ? v.images[0] : v.images?.[0]?.url;

              return (
                <View key={v._id} style={styles.variantBlock}>
                  <View style={styles.variantHeader}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.variantThumb} />
                    ) : (
                      <View style={[styles.variantThumb, { backgroundColor: v.colorHex || '#E2E8F0' }]} />
                    )}
                    <Text style={styles.variantColorName}>{v.colorName || 'Default Color'}</Text>
                  </View>

                  <View style={styles.sizesGrid}>
                    {v.sizes?.map((sz) => {
                      if (!sz._id) return null;
                      const key = `${item._id}_${v._id}_${sz._id}`;
                      const currentVal = stockInputs[key] !== undefined ? String(stockInputs[key]) : String(sz.stock);
                      const isSaving = savingKey === key;

                      return (
                        <View key={sz._id} style={styles.sizeRow}>
                          <View style={styles.sizeInfo}>
                            <Text style={styles.sizeBadge}>{sz.size}</Text>
                            {sz.sizeCode ? <Text style={styles.sizeCodeText}>({sz.sizeCode})</Text> : null}
                          </View>

                          <View style={styles.stockActionGroup}>
                            <TextInput
                              style={styles.stockInput}
                              keyboardType="numeric"
                              value={currentVal}
                              onChangeText={(val) => handleStockChange(key, val)}
                            />
                            <TouchableOpacity
                              style={styles.saveBtn}
                              onPress={() => handleSaveStock(item._id, v._id, sz.size, sz._id!)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Save size={14} color="#FFFFFF" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Search */}
      <View style={styles.searchBar}>
        <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, colors, sizes or SKUs..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E293B" />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item._id}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No products found for stock update.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  variantBlock: {
    marginTop: 12,
  },
  variantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  variantThumb: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
  },
  variantColorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  sizesGrid: {
    gap: 8,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sizeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sizeBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeCodeText: {
    fontSize: 12,
    color: '#64748B',
  },
  stockActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    width: 54,
    height: 34,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
