import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchMyConsignedWarehouseStock, applyForWarehouseService } from '../utils/api';
import { getMerchantEnteredSku } from '../utils/skuUtils';
import { Building2, Package, CheckCircle2, ArrowRight } from 'lucide-react-native';

interface ConsignedStockItem {
  _id: string;
  productTitle?: string;
  productId?: {
    title?: string;
    images?: (string | { url: string })[];
  };
  variantColor?: string;
  size: string;
  sizeCode?: string;
  quantity: number;
  warehouseName?: string;
}

export default function WarehouseStockScreen() {
  const router = useRouter();
  const [stockList, setStockList] = useState<ConsignedStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applying, setApplying] = useState(false);

  const loadConsignedStock = async () => {
    try {
      setLoading(true);
      const res = await fetchMyConsignedWarehouseStock();
      setStockList(res.consignedStock || res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch consigned warehouse stock:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadConsignedStock();
  }, []);

  const handleApplyWarehouse = async () => {
    Alert.alert(
      'Apply for FlashFits Central Warehouse',
      'By applying, FlashFits will allocate space in central fulfillment centers for rapid order dispatch. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Application',
          onPress: async () => {
            setApplying(true);
            try {
              await applyForWarehouseService();
              Alert.alert('Application Submitted', 'Our logistics team will contact you shortly to arrange inventory consignment.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to submit application.');
            } finally {
              setApplying(false);
            }
          },
        },
      ]
    );
  };

  const renderStockItem = ({ item }: { item: ConsignedStockItem }) => {
    const title = item.productTitle || item.productId?.title || 'Consigned Item';
    const imageObj = item.productId?.images?.[0];
    const imageUri = typeof imageObj === 'string' ? imageObj : imageObj?.url;

    return (
      <View style={styles.stockCard}>
        <View style={styles.cardHeader}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.productThumb} />
          ) : (
            <View style={styles.placeholderThumb}>
              <Package size={20} color="#64748B" />
            </View>
          )}

          <View style={styles.detailsCol}>
            <Text style={styles.productTitle} numberOfLines={1}>
              {title}
            </Text>
            {item.variantColor ? <Text style={styles.variantText}>Color: {item.variantColor}</Text> : null}
            <View style={styles.sizeCodeRow}>
              <Text style={styles.sizeBadge}>Size: {item.size}</Text>
              {item.sizeCode ? <Text style={styles.sizeCodeText}>SKU: {getMerchantEnteredSku(item.sizeCode, item.sizeCode)}</Text> : null}
            </View>
          </View>

          <View style={styles.qtyBadgeCol}>
            <Text style={styles.qtyNumber}>{item.quantity}</Text>
            <Text style={styles.qtyLabel}>Units</Text>
          </View>
        </View>

        {item.warehouseName ? (
          <View style={styles.warehouseFooter}>
            <Building2 size={14} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.warehouseText}>{item.warehouseName}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Banner */}
      <View style={styles.bannerCard}>
        <Building2 size={24} color="#1E293B" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Consignment Fulfillment (Read-Only)</Text>
          <Text style={styles.bannerSub}>
            Stock items stored in central FlashFits warehouses for rapid fulfillment. Details and inventory levels are managed directly by central warehouse operators.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E293B" />
        </View>
      ) : (
        <FlatList
          data={stockList}
          keyExtractor={(item, index) => item._id || String(index)}
          renderItem={renderStockItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConsignedStock(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Consigned Stock Yet</Text>
              <Text style={styles.emptyText}>
                You have not consigned stock to FlashFits central warehouses. Apply to boost order speeds.
              </Text>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleApplyWarehouse}
                disabled={applying}
              >
                {applying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.applyBtnText}>Apply for Fulfillment Service</Text>
                    <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>
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
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  bannerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
  },
  placeholderThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailsCol: {
    flex: 1,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  variantText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sizeCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  sizeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeCodeText: {
    fontSize: 11,
    color: '#64748B',
  },
  qtyBadgeCol: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  qtyNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  qtyLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  warehouseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  warehouseText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
