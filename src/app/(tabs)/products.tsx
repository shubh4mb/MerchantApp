import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api, { BACKEND_URL, resolveImageUrl, updateSingleSizeStock } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Plus, Minus, Trash2, Edit3, Settings, Save, ChevronDown, ChevronUp, Barcode, Package, Layers, Search, X, Filter, ArrowUpDown, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getMerchantEnteredSku } from '../../utils/skuUtils';

interface SizeStock {
  _id: string;
  size: string;
  sizeCode?: string;
  merchantSizeCode?: string;
  stock: number;
}

interface ProductVariant {
  _id: string;
  color: string | { name?: string; hex?: string };
  mrp: number;
  price: number;
  discount: number;
  images: (string | { public_id?: string; url: string; _id?: string })[];
  sizes: SizeStock[];
}

interface Product {
  id: string;
  _id?: string;
  styleGroupId?: string;
  styleCode?: string;
  productCode?: string;
  merchantSizeCode?: string;
  productSku?: string;
  name: string;
  brand: string | { _id?: string; name?: string };
  category: string | { _id?: string; name?: string };
  subCategory: string | { _id?: string; name?: string };
  isActive: boolean;
  isTriable: boolean;
  source?: string;
  warehouseId?: any;
  addedByOperator?: any;
  images?: (string | { url: string })[];
  variants: ProductVariant[];
}

export default function ProductsScreen() {
  const { merchant } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingSizeId, setUpdatingSizeId] = useState<string | null>(null);

  // Search, Filter & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'stock_desc'>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Pagination states
  const ITEMS_PER_PAGE = 24;
  const [currentPage, setCurrentPage] = useState(1);

  // Column switcher and Grid measurements
  const { width: screenWidth } = useWindowDimensions();
  const [numColumns, setNumColumns] = useState<3 | 4>(4);

  // Detail Bottom Sheet state
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  const [reopenDetailId, setReopenDetailId] = useState<string | null>(null);
  const [editingSizeKey, setEditingSizeKey] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState<string>('0');
  const [savingSizeId, setSavingSizeId] = useState<string | null>(null);

  const handleCloseDetailModal = () => {
    setSelectedDetailProduct(null);
    setEditingSizeKey(null);
  };

  const HORIZONTAL_PADDING = 10;
  const GAP = 6;
  const cardWidth = Math.floor(
    (screenWidth - HORIZONTAL_PADDING * 2 - (numColumns - 1) * GAP) / numColumns
  );

  // Reset pagination when search, filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryFilter, selectedSubCategoryFilter, statusFilter, sortBy]);

  // Safe category & subcategory string extraction helpers
  const getCategoryName = (p: Product | any): string => {
    if (!p) return '';
    const c = p.category;
    if (typeof c === 'string') return c.trim();
    if (c && typeof c === 'object' && c.name) return String(c.name).trim();
    const cId = p.categoryId;
    if (typeof cId === 'object' && cId?.name) return String(cId.name).trim();
    return '';
  };

  const getSubCategoryName = (p: Product | any): string => {
    if (!p) return '';
    const sc = p.subCategory;
    if (typeof sc === 'string') return sc.trim();
    if (sc && typeof sc === 'object' && sc.name) return String(sc.name).trim();
    const scId = p.subCategoryId;
    if (typeof scId === 'object' && scId?.name) return String(scId.name).trim();
    return '';
  };

  // Extract unique category names and their product counts
  const { categoriesList, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const set = new Set<string>();
    products.forEach((p) => {
      const catName = getCategoryName(p);
      if (catName) {
        set.add(catName);
        counts[catName] = (counts[catName] || 0) + 1;
      }
    });
    return {
      categoriesList: ['All', ...Array.from(set).sort()],
      categoryCounts: counts,
    };
  }, [products]);

  // Extract unique subcategories and product counts for selected category
  const { subCategoriesList, subCategoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const set = new Set<string>();
    products.forEach((p) => {
      const catName = getCategoryName(p);
      const subCatName = getSubCategoryName(p);
      if (!subCatName) return;

      if (selectedCategoryFilter === 'All' || catName === selectedCategoryFilter) {
        set.add(subCatName);
        counts[subCatName] = (counts[subCatName] || 0) + 1;
      }
    });
    return {
      subCategoriesList: ['All', ...Array.from(set).sort()],
      subCategoryCounts: counts,
    };
  }, [products, selectedCategoryFilter]);

  // Auto-reset subcategory filter if selected subcategory does not exist in active category
  useEffect(() => {
    if (selectedSubCategoryFilter !== 'All' && !subCategoriesList.includes(selectedSubCategoryFilter)) {
      setSelectedSubCategoryFilter('All');
    }
  }, [selectedCategoryFilter, subCategoriesList, selectedSubCategoryFilter]);

  // Real-time stock counts across all products
  const stockCounts = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    products.forEach((p) => {
      let totalStock = 0;
      (p.variants || []).forEach((v) => {
        (v.sizes || []).forEach((sz) => {
          totalStock += Number(sz.stock) || 0;
        });
      });

      if (totalStock > 0) inStock++;
      if (totalStock > 0 && totalStock <= 5) lowStock++;
      if (totalStock <= 0) outOfStock++;
    });

    return { inStock, lowStock, outOfStock };
  }, [products]);

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategoryFilter !== 'All') count++;
    if (selectedSubCategoryFilter !== 'All') count++;
    if (statusFilter !== 'ALL') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [selectedCategoryFilter, selectedSubCategoryFilter, statusFilter, sortBy]);

  // Robust normalized search helper (handles hyphens, spaces, e.g. "tshirt" matches "T-Shirt")
  const normalizeSearch = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const matchesSearchNormalized = (target: string, query: string): boolean => {
    if (!target || !query) return false;
    const rawTarget = target.toLowerCase();
    const rawQuery = query.toLowerCase().trim();
    if (rawTarget.includes(rawQuery)) return true;

    const normTarget = normalizeSearch(target);
    const normQuery = normalizeSearch(query);
    if (normQuery && normTarget.includes(normQuery)) return true;

    // Plural/singular tolerance (e.g. "tshirts" matches "tshirt", "shirts" matches "shirt")
    if (normQuery.length > 3 && normQuery.endsWith('s')) {
      const stemQuery = normQuery.slice(0, -1);
      if (normTarget.includes(stemQuery)) return true;
    }
    if (normTarget.length > 3 && normTarget.endsWith('s')) {
      const stemTarget = normTarget.slice(0, -1);
      if (normQuery.includes(stemTarget)) return true;
    }

    const words = rawQuery.split(/[\s-_]+/).filter((w) => w.length > 0);
    if (words.length > 1) {
      const allWordsMatch = words.every((w) => {
        const nw = normalizeSearch(w);
        return rawTarget.includes(w) || (nw && normTarget.includes(nw)) || (nw.length > 3 && nw.endsWith('s') && normTarget.includes(nw.slice(0, -1)));
      });
      if (allWordsMatch) return true;
    }

    return false;
  };

  // Instant category and subcategory matches based on search query
  const categorySuggestions = useMemo(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return [];
    return categoriesList.filter((cat) => cat !== 'All' && matchesSearchNormalized(cat, q));
  }, [searchQuery, categoriesList]);

  const subCategorySuggestions = useMemo(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return [];
    return subCategoriesList.filter((sub) => sub !== 'All' && matchesSearchNormalized(sub, q));
  }, [searchQuery, subCategoriesList]);

  // Compute filtered & sorted list
  const processedProducts = useMemo(() => {
    let result = products.filter((p) => {
      const brandName = typeof p.brand === 'object' ? (p.brand as any)?.name : p.brand;
      const catName = getCategoryName(p);
      const subCatName = getSubCategoryName(p);
      const code = p.productCode || p.styleCode || p.styleGroupId || p.id || p._id || '';
      const colorName = typeof p.variants?.[0]?.color === 'object' ? p.variants?.[0]?.color?.name : p.variants?.[0]?.color;

      // Category filter check
      if (selectedCategoryFilter !== 'All' && catName !== selectedCategoryFilter) {
        return false;
      }

      // SubCategory filter check
      if (selectedSubCategoryFilter !== 'All' && subCatName !== selectedSubCategoryFilter) {
        return false;
      }

      // Stock status filter check
      if (statusFilter !== 'ALL') {
        let totalStock = 0;
        (p.variants || []).forEach((v) => {
          (v.sizes || []).forEach((sz) => {
            totalStock += Number(sz.stock) || 0;
          });
        });

        if (statusFilter === 'IN_STOCK' && totalStock <= 0) return false;
        if (statusFilter === 'LOW_STOCK' && (totalStock <= 0 || totalStock > 5)) return false;
        if (statusFilter === 'OUT_OF_STOCK' && totalStock > 0) return false;
      }

      // Search query check with hyphen and space tolerance
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim();

      return (
        matchesSearchNormalized(p.name, q) ||
        matchesSearchNormalized(brandName || '', q) ||
        matchesSearchNormalized(catName || '', q) ||
        matchesSearchNormalized(subCatName || '', q) ||
        matchesSearchNormalized(code || '', q) ||
        matchesSearchNormalized(getMerchantEnteredSku(code, (p as any).merchantSizeCode), q) ||
        matchesSearchNormalized(colorName || '', q)
      );
    });

    // Apply Sorting
    return [...result].sort((a, b) => {
      const priceA = a.variants?.[0]?.price || 0;
      const priceB = b.variants?.[0]?.price || 0;
      const stockA = (a.variants?.[0]?.sizes || []).reduce((acc, s) => acc + (Number(s.stock) || 0), 0);
      const stockB = (b.variants?.[0]?.sizes || []).reduce((acc, s) => acc + (Number(s.stock) || 0), 0);

      switch (sortBy) {
        case 'price_asc':
          return priceA - priceB;
        case 'price_desc':
          return priceB - priceA;
        case 'name_asc': {
          const brandA = typeof a.brand === 'object' ? (a.brand as any)?.name || '' : (a.brand || '');
          const brandB = typeof b.brand === 'object' ? (b.brand as any)?.name || '' : (b.brand || '');
          return brandA.localeCompare(brandB);
        }
        case 'stock_desc':
          return stockB - stockA;
        case 'newest':
        default:
          return 0; // Maintain original backend order
      }
    });
  }, [products, searchQuery, selectedCategoryFilter, selectedSubCategoryFilter, statusFilter, sortBy]);

  // Paginated slice of products for optimal rendering performance
  const paginatedProducts = useMemo(() => {
    return processedProducts.slice(0, currentPage * ITEMS_PER_PAGE);
  }, [processedProducts, currentPage]);

  const handleLoadMore = () => {
    if (paginatedProducts.length < processedProducts.length) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  // Active product for detail sheet synced with live products list
  const activeDetailProduct = useMemo(() => {
    if (!selectedDetailProduct) return null;
    return (
      products.find(
        (p) => (p.id || p._id) === (selectedDetailProduct.id || selectedDetailProduct._id)
      ) || selectedDetailProduct
    );
  }, [products, selectedDetailProduct]);

  useEffect(() => {
    if (reopenDetailId && products.length > 0) {
      const found = products.find((p) => (p.id || p._id) === reopenDetailId);
      if (found) {
        setSelectedDetailProduct(found);
      }
      setReopenDetailId(null);
    }
  }, [products, reopenDetailId]);

  // States for Stock Modal
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [sizeList, setSizeList] = useState<{ size: string; stock: string; sizeCode?: string }[]>([]);

  // States for Price Modal
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [mrpInput, setMrpInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');

  // States for uploading
  const [uploadingIndex, setUploadingIndex] = useState<{ prodId: string; varIdx: number } | null>(null);

  const fetchProducts = async () => {
    const mId = merchant?._id || merchant?.id;
    if (!mId) return;
    try {
      setLoading(true);
      const response = await api.get(`/merchant/fetchProductsByMerchantId/${mId}`);
      const rawList = Array.isArray(response.data) ? response.data : (response.data?.products || []);
      
      // Each variant/product in rawList is shown in its own card
      const productList: Product[] = rawList.map((p: any, pIdx: number) => {
        const pId = p._id || p.id || `prod_${pIdx}`;
        const colorVal = p.color || { name: 'Default', hex: '#000000' };
        const pCode = p.productCode || p.styleCode || p.styleGroupId || p._id || p.id;

        // Gather any root sizes or flat size on p
        const rootSizes: SizeStock[] = Array.isArray(p.sizes) && p.sizes.length > 0
          ? p.sizes.map((s: any) => ({
              _id: s._id || `${pId}_${s.size}`,
              size: s.size || '',
              stock: Number(s.stock) || 0,
              sizeCode: s.sizeCode || '',
              merchantSizeCode: s.merchantSizeCode || s.sizeCode || '',
            }))
          : (p.size
              ? [{
                  _id: p._id || pId,
                  size: p.size,
                  stock: Number(p.stock) || 0,
                  merchantSizeCode: p.merchantSizeCode || '',
                  sizeCode: p.sizeCode || '',
                  productCode: pCode,
                }]
              : []);

        const rawVariants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : [];

        const variants: ProductVariant[] = rawVariants.length > 0
          ? rawVariants.map((v: any, vIdx: number) => {
              const vSizes: SizeStock[] = Array.isArray(v.sizes) && v.sizes.length > 0
                ? v.sizes.map((s: any) => ({
                    _id: s._id || `${v._id || pId}_${s.size}`,
                    size: s.size || '',
                    stock: Number(s.stock) || 0,
                    sizeCode: s.sizeCode || '',
                    merchantSizeCode: s.merchantSizeCode || s.sizeCode || '',
                  }))
                : (rootSizes.length > 0
                    ? rootSizes
                    : (v.size
                        ? [{
                            _id: v._id || `${pId}_${vIdx}`,
                            size: v.size,
                            stock: Number(v.stock) || 0,
                            merchantSizeCode: v.merchantSizeCode || '',
                            sizeCode: v.sizeCode || '',
                          }]
                        : []));

              return {
                _id: v._id || `var_${pIdx}_${vIdx}`,
                color: v.color || colorVal,
                mrp: v.mrp || p.mrp || 0,
                price: v.price || p.price || 0,
                discount: v.discount || p.discount || 0,
                images: v.images || p.images || [],
                sizes: vSizes,
              };
            })
          : [{
              _id: p._id || `var_${pIdx}`,
              color: colorVal,
              mrp: p.mrp || 0,
              price: p.price || 0,
              discount: p.discount || 0,
              images: p.images || [],
              sizes: rootSizes,
            }];

        return {
          id: pId,
          _id: p._id || pId,
          styleGroupId: p.styleGroupId || pId,
          styleCode: p.styleCode || pCode,
          productCode: pCode,
          merchantSizeCode: p.merchantSizeCode || p.productSku || '',
          productSku: p.productSku || '',
          name: p.name || 'Unnamed Product',
          brand: p.brand || p.brandId || '',
          category: p.category || p.categoryId || '',
          subCategory: p.subCategory || p.subCategoryId || '',
          isActive: p.isActive !== false,
          isTriable: p.isTriable !== false,
          source: p.source,
          warehouseId: p.warehouseId,
          addedByOperator: p.addedByOperator,
          images: p.images || [],
          variants: variants,
        };
      });

      setProducts(productList);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [merchant?._id, merchant?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  // 📷 Trigger Camera or Photo Picker and Upload to variant
  const handlePhotoClick = async (productId: string, variantIndex: number, variantId: string) => {

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraPermission.granted || !galleryPermission.granted) {
      Alert.alert('Permission Denied', 'Camera and Photo Library access is required to add product photos.');
      return;
    }

    Alert.alert(
      'Upload Variant Photo',
      'Choose an image source:',
      [
        {
          text: 'Snap Photo (Camera)',
          onPress: () => captureImageFromCamera(productId, variantIndex, variantId),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => pickImageFromGallery(productId, variantIndex, variantId),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const captureImageFromCamera = async (productId: string, variantIndex: number, variantId: string) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await uploadCapturedImage(result.assets[0].uri, productId, variantIndex, variantId);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  const pickImageFromGallery = async (productId: string, variantIndex: number, variantId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await uploadCapturedImage(result.assets[0].uri, productId, variantIndex, variantId);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick photo.');
    }
  };

  const uploadCapturedImage = async (uri: string, productId: string, variantIndex: number, variantId: string) => {
    setUploadingIndex({ prodId: productId, varIdx: variantIndex });
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('images', {
        uri,
        name: filename,
        type,
      } as any);
      formData.append('productId', productId);
      formData.append('variantIndex', variantIndex.toString());

      await api.post('/merchant/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Photo uploaded successfully.');
      fetchProducts();
    } catch (error: any) {
      Alert.alert('Upload Failed', error.response?.data?.message || error.message || 'Server error uploading image.');
    } finally {
      setUploadingIndex(null);
    }
  };

  // Inline Stock Increment / Decrement Update
  const handleInlineStockChange = async (
    productId: string,
    variantId: string,
    sizeId: string,
    sizeName: string,
    newStock: number
  ): Promise<boolean> => {
    if (newStock < 0) return false;

    setUpdatingSizeId(sizeId);

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => {
        const pId = p.id || p._id;
        if (pId !== productId) return p;
        const updatedVariants = (p.variants || []).map((v) => {
          if (v._id !== variantId) return v;
          const updatedSizes = (v.sizes || []).map((sz) => {
            if (sz._id !== sizeId && sz.size !== sizeName) return sz;
            return { ...sz, stock: newStock };
          });
          return { ...v, sizes: updatedSizes };
        });
        return { ...p, variants: updatedVariants };
      })
    );

    try {
      await updateSingleSizeStock(productId, variantId, sizeName, newStock);
      return true;
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update size stock.');
      fetchProducts(); // revert
      return false;
    } finally {
      setUpdatingSizeId(null);
    }
  };

  const handleSaveSingleSize = async (
    product: Product,
    variant: ProductVariant,
    sz: SizeStock
  ) => {
    const pId = product.id || product._id || '';
    const vId = variant._id;
    const sId = sz._id || `${pId}_${sz.size}`;
    const newStock = Math.max(0, parseInt(editingStockVal, 10) || 0);
    const sizeKey = `${vId}_${sz._id || sz.size}`;

    setSavingSizeId(sizeKey);
    try {
      const success = await handleInlineStockChange(pId, vId, sId, sz.size, newStock);
      if (success) {
        setEditingSizeKey(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update stock');
    } finally {
      setSavingSizeId(null);
    }
  };

  const handleQuickEditStock = (product: Product) => {
    // If product has no variants array, check if it has root sizes/stock
    if (!product.variants || product.variants.length === 0) {
      const fallbackSizes: SizeStock[] = (product as any).sizes?.length > 0
        ? (product as any).sizes
        : (product as any).size
          ? [{
              _id: product.id || product._id || 'default_sz',
              size: (product as any).size,
              stock: (product as any).stock ?? 0,
              merchantSizeCode: (product as any).merchantSizeCode || '',
            }]
          : [];

      if (fallbackSizes.length > 0) {
        handleOpenStockModal(product, {
          _id: product.id || product._id || 'default_var',
          color: 'Default',
          mrp: 0,
          price: 0,
          discount: 0,
          images: product.images || [],
          sizes: fallbackSizes,
        });
        return;
      }

      Alert.alert('No Variants', 'Please add a color variant first to manage stock.');
      return;
    }

    if (product.variants.length === 1) {
      handleOpenStockModal(product, product.variants[0]);
    } else {
      const options = product.variants.map((v, idx) => {
        const colorName = typeof v.color === 'object' ? v.color?.name || `Variant ${idx + 1}` : (v.color || `Variant ${idx + 1}`);
        const vStock = (v.sizes || []).reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
        return {
          text: `${colorName} (${vStock} in stock)`,
          onPress: () => handleOpenStockModal(product, v),
        };
      });
      options.push({ text: 'Cancel', style: 'cancel' } as any);

      const pBrand = typeof product.brand === 'object' ? (product.brand as any)?.name : product.brand;
      Alert.alert(
        'Select Variant for Stock Update',
        `Choose variant stock to edit for ${pBrand || 'product'}:`,
        options
      );
    }
  };

  const handleOpenStockModal = (product: Product, variant: ProductVariant) => {
    setSelectedProduct(product);
    setSelectedVariant(variant);

    // Multi-tier fallback to extract sizes so stock is NEVER empty when data exists
    let sourceSizes: SizeStock[] = Array.isArray(variant.sizes) && variant.sizes.length > 0 ? variant.sizes : [];
    if (sourceSizes.length === 0 && Array.isArray((product as any).sizes) && (product as any).sizes.length > 0) {
      sourceSizes = (product as any).sizes;
    }
    if (sourceSizes.length === 0 && ((variant as any).size || (product as any).size)) {
      sourceSizes = [{
        _id: variant._id || product.id || product._id || 'default_sz',
        size: (variant as any).size || (product as any).size || 'Free Size',
        stock: (variant as any).stock ?? (product as any).stock ?? 0,
        merchantSizeCode: (variant as any).merchantSizeCode || (product as any).merchantSizeCode || '',
        productCode: (variant as any).productCode || product.productCode || '',
      } as any];
    }

    if (sourceSizes.length === 0) {
      // Provide a clean default row ready to enter
      setSizeList([{ size: 'Free Size', stock: '0', sizeCode: '' }]);
    } else {
      setSizeList(
        sourceSizes.map((s) => {
          const rawCode = s.merchantSizeCode || s.sizeCode || (s as any).productCode || '';
          const cleaned = getMerchantEnteredSku(rawCode, s.merchantSizeCode, [s]);
          const stockVal = s.stock !== undefined && s.stock !== null ? String(s.stock) : '0';
          return {
            size: s.size || '',
            stock: stockVal,
            sizeCode: cleaned !== '—' ? cleaned : (s.sizeCode || ''),
          };
        })
      );
    }
    setStockModalVisible(true);
  };

  const handleSaveStock = async () => {
    if (!selectedProduct || !selectedVariant) return;

    try {
      const formattedSizes = sizeList.map((s) => ({
        size: s.size.trim(),
        merchantSizeCode: s.sizeCode?.trim() || undefined,
        stock: parseInt(s.stock, 10) || 0,
      }));

      const targetProdId = selectedProduct.styleGroupId || selectedProduct.id || selectedProduct._id;
      const targetVarId = selectedVariant._id;

      await api.patch(
        `merchant/updateMultipleVariantSizes/${targetProdId}/${targetVarId}`,
        { sizes: formattedSizes }
      );

      Alert.alert('Success', 'Stock inventory updated.');
      setStockModalVisible(false);
      fetchProducts();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update stock.');
    }
  };

  const handleAddSizeRow = () => {
    setSizeList([...sizeList, { size: '', stock: '0', sizeCode: '' }]);
  };

  const handleRemoveSizeRow = (index: number) => {
    setSizeList(sizeList.filter((_, idx) => idx !== index));
  };

  // Pricing Modals functions
  const handleOpenPriceModal = (product: Product, variant: ProductVariant) => {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setMrpInput(variant.mrp.toString());
    setPriceInput(variant.price.toString());
    setDiscountInput((variant.discount || 0).toString());
    setPriceModalVisible(true);
  };

  const handleSavePrice = async () => {
    if (!selectedProduct || !selectedVariant) return;
    try {
      await api.put(
        `merchant/updatePrice/${selectedProduct.id || selectedProduct._id}/${selectedVariant._id}`,
        {
          mrp: parseFloat(mrpInput) || 0,
          price: parseFloat(priceInput) || 0,
          discount: parseFloat(discountInput) || 0,
        }
      );
      Alert.alert('Success', 'Pricing updated successfully.');
      setPriceModalVisible(false);
      fetchProducts();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update pricing.');
    }
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${productName || 'this product'}" and all its color variations? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/merchant/deleteProduct/${productId}`);
              Alert.alert('Success', 'Product deleted successfully.');
              setSelectedDetailProduct(null);
              fetchProducts();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to delete product.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteVariant = (productId: string, variantId: string) => {
    Alert.alert(
      'Delete Variant',
      'Are you sure you want to delete this color variant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/merchant/deleteVariant/${productId}/${variantId}`);
              Alert.alert('Success', 'Variant deleted successfully.');
              fetchProducts();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to delete variant.');
            }
          },
        },
      ]
    );
  };

  const getImageUrl = (img: any): string | null => {
    if (!img) return null;
    const uri = typeof img === 'string' ? img : img.url || null;
    return resolveImageUrl(uri);
  };

  // Helper to verify genuine merchant-entered code (filters out raw ObjectIds, #hashes, PRD- prefixes)
  const isRealMerchantCode = (val?: string | null): boolean => {
    if (!val) return false;
    const t = val.trim();
    if (!t || t === '—') return false;
    if (/^[a-f\d]{24}$/i.test(t)) return false;
    if (t.startsWith('#') && t.length <= 8) return false;
    if (t.startsWith('PRD-') || t.startsWith('WH-')) return false;
    if (t.startsWith('prod_')) return false;
    return true;
  };

  // Helper to extract clean merchant-entered SKU / code from product
  const getProductDisplayCode = (product: Product): string => {
    const allSizes = (product.variants || []).flatMap((v) => v.sizes || []);
    const rawDisplay =
      product.merchantSizeCode ||
      product.productSku ||
      (product as any).merchantSizeCode ||
      product.productCode ||
      product.styleCode;
    const cleanedSku = getMerchantEnteredSku(
      rawDisplay,
      product.merchantSizeCode || product.productSku || (product as any).merchantSizeCode,
      allSizes
    );
    return isRealMerchantCode(cleanedSku) ? cleanedSku : '';
  };

  // Helper to compute total stock across all variants
  const getProductTotalStock = (product: Product): number => {
    let total = 0;
    (product.variants || []).forEach((v) => {
      (v.sizes || []).forEach((sz) => {
        total += Number(sz.stock) || 0;
      });
    });
    return total;
  };

  // Helper to extract aggregated size stock summary
  const getDetailSizeSummary = (product: Product) => {
    const sizeStockMap: { [key: string]: { stock: number } } = {};
    (product.variants || []).forEach((variant) => {
      (variant.sizes || []).forEach((sz) => {
        const sName = sz.size || 'Free';
        const sStock = Number(sz.stock) || 0;
        if (!sizeStockMap[sName]) {
          sizeStockMap[sName] = { stock: sStock };
        } else {
          sizeStockMap[sName].stock += sStock;
        }
      });
    });
    return Object.keys(sizeStockMap).map((sName) => ({
      size: sName,
      stock: sizeStockMap[sName].stock,
    }));
  };

  // Pure Product Card for the Grid
  const renderProductItem = ({ item }: { item: Product }) => {
    const coverImageObj = item.images?.[0] || item.variants?.[0]?.images?.[0];
    const coverImageUri = getImageUrl(coverImageObj);
    const displayCode = getProductDisplayCode(item);
    const totalStock = getProductTotalStock(item);
    const isWh = item.source === 'warehouse' || !!item.warehouseId || !!item.addedByOperator;
    const sizeSummary = getDetailSizeSummary(item);
    const firstVariant = item.variants?.[0];
    const displayPrice = firstVariant?.price ?? (item as any).price ?? 0;
    const displayMrp = firstVariant?.mrp ?? (item as any).mrp ?? 0;

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setSelectedDetailProduct(item)}
        style={[styles.gridCard, { width: cardWidth }]}
      >
        {/* Code Bar Above Image */}
        <View style={styles.gridCodeBar}>
          <Text style={styles.gridCodeText} numberOfLines={1}>
            {displayCode || '—'}
          </Text>
        </View>

        {/* Dress Image */}
        <View style={[styles.gridImageContainer, { height: Math.round(cardWidth * 1.18) }]}>
          {coverImageUri ? (
            <Image
              source={{ uri: coverImageUri }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.gridPlaceholderImage}>
              <ImageIcon size={numColumns === 4 ? 18 : 22} color="#94A3B8" />
            </View>
          )}

          {isWh ? (
            <View style={styles.gridWhBadge}>
              <Text style={styles.gridWhBadgeText}>WH</Text>
            </View>
          ) : null}
        </View>

        {/* Stock Bar Below Image */}
        <View
          style={[
            styles.gridStockBar,
            totalStock === 0
              ? styles.gridStockBarOut
              : totalStock <= 3
              ? styles.gridStockBarLow
              : styles.gridStockBarIn,
          ]}
        >
          <Text
            style={[
              styles.gridStockText,
              totalStock === 0
                ? styles.gridStockTextOut
                : totalStock <= 3
                ? styles.gridStockTextLow
                : styles.gridStockTextIn,
            ]}
            numberOfLines={1}
          >
            {totalStock === 0 ? '0' : `${totalStock}`} {numColumns === 3 ? 'stock' : ''}
          </Text>
        </View>

        {/* Available Sizes with Stock Below Stock Bar */}
        <View style={styles.gridSizesContainer}>
          {sizeSummary.length > 0 ? (
            <View style={styles.gridSizesWrap}>
              {sizeSummary.map((sz, sIdx) => (
                <View
                  key={sIdx}
                  style={[
                    styles.gridSizePill,
                    sz.stock === 0 && styles.gridSizePillOut,
                  ]}
                >
                  <Text
                    style={[
                      styles.gridSizePillText,
                      sz.stock === 0 && styles.gridSizePillTextOut,
                    ]}
                    numberOfLines={1}
                  >
                    {sz.size}:{sz.stock}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.gridNoSizesText}>—</Text>
          )}
        </View>

        {/* Selling Price */}
        <View style={styles.gridPriceBar}>
          <Text style={styles.gridPriceText}>₹{displayPrice}</Text>
          {displayMrp > displayPrice ? (
            <Text style={styles.gridMrpText}>₹{displayMrp}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSub}>
            {processedProducts.length} {processedProducts.length === 1 ? 'Item' : 'Items'}
            {searchQuery || selectedCategoryFilter !== 'All' || selectedSubCategoryFilter !== 'All' ? ` (filtered from ${products.length})` : ''}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Column Toggle (3 Col vs 4 Col) */}
          <View style={styles.gridToggleContainer}>
            <TouchableOpacity
              style={[styles.gridToggleBtn, numColumns === 3 && styles.gridToggleBtnActive]}
              onPress={() => setNumColumns(3)}
              activeOpacity={0.7}
            >
              <Text style={[styles.gridToggleText, numColumns === 3 && styles.gridToggleTextActive]}>3 Col</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.gridToggleBtn, numColumns === 4 && styles.gridToggleBtnActive]}
              onPress={() => setNumColumns(4)}
              activeOpacity={0.7}
            >
              <Text style={[styles.gridToggleText, numColumns === 4 && styles.gridToggleTextActive]}>4 Col</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-product')}>
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar, Sort Button & Category Filter Chips */}
      <View style={styles.searchFilterWrapper}>
        <View style={styles.searchRowContainer}>
          <View style={styles.searchBarBox}>
            <Search size={18} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInputField}
              placeholder="Search name, brand, category, SKU..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.sortBtn, (statusFilter !== 'ALL' || selectedCategoryFilter !== 'All' || selectedSubCategoryFilter !== 'All') && styles.sortBtnActive]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Filter size={16} color={(statusFilter !== 'ALL' || selectedCategoryFilter !== 'All' || selectedSubCategoryFilter !== 'All') ? '#FFFFFF' : '#475569'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortBtn, sortBy !== 'newest' && styles.sortBtnActive]}
            onPress={() => setSortModalVisible(true)}
          >
            <ArrowUpDown size={16} color={sortBy !== 'newest' ? '#FFFFFF' : '#475569'} />
          </TouchableOpacity>
        </View>

        {/* Quick Category & Subcategory Suggestion Strip during Search */}
        {searchQuery.trim().length >= 2 && (categorySuggestions.length > 0 || subCategorySuggestions.length > 0) && (
          <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginRight: 2 }}>
                  Matches:
                </Text>
                {categorySuggestions.map((cat) => (
                  <TouchableOpacity
                    key={`cat-sug-${cat}`}
                    style={[styles.filterChipItem, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}
                    onPress={() => {
                      setSelectedCategoryFilter(cat);
                      setSelectedSubCategoryFilter('All');
                      setSearchQuery('');
                    }}
                  >
                    <Text style={[styles.filterChipItemText, { color: '#1D4ED8', fontWeight: '700' }]}>
                      Category: {cat} ({categoryCounts[cat] || 0})
                    </Text>
                  </TouchableOpacity>
                ))}
                {subCategorySuggestions.map((sub) => {
                  const parentOfSub = products.find((p) => getSubCategoryName(p) === sub);
                  const pCat = parentOfSub ? getCategoryName(parentOfSub) : 'All';
                  return (
                    <TouchableOpacity
                      key={`sub-sug-${sub}`}
                      style={[styles.subFilterChipItem, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                      onPress={() => {
                        if (pCat && pCat !== 'All') setSelectedCategoryFilter(pCat);
                        setSelectedSubCategoryFilter(sub);
                        setSearchQuery('');
                      }}
                    >
                      <Text style={[styles.subFilterChipItemText, { color: '#047857', fontWeight: '700' }]}>
                        Sub: {sub} ({subCategoryCounts[sub] || 0})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Categories Filter Chips with Product Counts */}
        {categoriesList.length > 1 && (
          <View style={{ marginTop: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {categoriesList.map((cat) => {
                  const isSel = selectedCategoryFilter === cat;
                  const count = cat === 'All' ? products.length : (categoryCounts[cat] || 0);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filterChipItem, isSel && styles.filterChipItemActive]}
                      onPress={() => {
                        setSelectedCategoryFilter(cat);
                        if (cat !== selectedCategoryFilter) {
                          setSelectedSubCategoryFilter('All');
                        }
                      }}
                    >
                      <Text style={[styles.filterChipItemText, isSel && styles.filterChipItemTextActive]}>
                        {cat} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Subcategories Filter Chips with Product Counts */}
        {subCategoriesList.length > 1 && (
          <View style={{ marginTop: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {subCategoriesList.map((subCat) => {
                  const isSel = selectedSubCategoryFilter === subCat;
                  const count = subCat === 'All'
                    ? (selectedCategoryFilter === 'All' ? products.length : (categoryCounts[selectedCategoryFilter] || 0))
                    : (subCategoryCounts[subCat] || 0);
                  return (
                    <TouchableOpacity
                      key={subCat}
                      style={[styles.subFilterChipItem, isSel && styles.subFilterChipItemActive]}
                      onPress={() => setSelectedSubCategoryFilter(subCat)}
                    >
                      <Text style={[styles.subFilterChipItemText, isSel && styles.subFilterChipItemTextActive]}>
                        {subCat} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Active Filters Row */}
        {(statusFilter !== 'ALL' || selectedCategoryFilter !== 'All' || selectedSubCategoryFilter !== 'All' || sortBy !== 'newest') && (
          <View style={styles.activeFiltersRow}>
            {statusFilter !== 'ALL' && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>
                  {statusFilter === 'IN_STOCK' ? 'In Stock' : statusFilter === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
                </Text>
                <TouchableOpacity onPress={() => setStatusFilter('ALL')}>
                  <X size={12} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            )}
            {selectedCategoryFilter !== 'All' && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{selectedCategoryFilter}</Text>
                <TouchableOpacity onPress={() => {
                  setSelectedCategoryFilter('All');
                  setSelectedSubCategoryFilter('All');
                }}>
                  <X size={12} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            )}
            {selectedSubCategoryFilter !== 'All' && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>Sub: {selectedSubCategoryFilter}</Text>
                <TouchableOpacity onPress={() => setSelectedSubCategoryFilter('All')}>
                  <X size={12} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            )}
            {sortBy !== 'newest' && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>Sorted</Text>
                <TouchableOpacity onPress={() => setSortBy('newest')}>
                  <X size={12} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      ) : (
        <FlatList
          key={`products_grid_${numColumns}`}
          data={paginatedProducts}
          renderItem={renderProductItem}
          keyExtractor={(item, index) => `${item.id || item._id || 'prod'}_${index}`}
          numColumns={numColumns}
          columnWrapperStyle={{
            gap: GAP,
            paddingHorizontal: HORIZONTAL_PADDING,
            marginBottom: GAP,
          }}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1A1A1A']} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            paginatedProducts.length < processedProducts.length ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
                <Text style={styles.loadMoreText}>
                  Show More ({processedProducts.length - paginatedProducts.length} remaining)
                </Text>
              </TouchableOpacity>
            ) : processedProducts.length > ITEMS_PER_PAGE ? (
              <View style={styles.endOfListContainer}>
                <Text style={styles.endOfListText}>Showing all {processedProducts.length} items</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ImageIcon size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search query, category filter, or sorting option.
              </Text>
            </View>
          }
        />
      )}

      {/* Slide-Up Product Detail Bottom Sheet (No Accordion) */}
      <Modal
        visible={!!activeDetailProduct}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseDetailModal}
      >
        <View style={styles.detailModalOverlay}>
          <TouchableOpacity
            style={styles.detailModalBackdrop}
            activeOpacity={1}
            onPress={handleCloseDetailModal}
          />

          <View style={styles.detailSheetContent}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandleContainer}>
              <View style={styles.sheetHandle} />
            </View>

            {activeDetailProduct && (() => {
              const prodId = activeDetailProduct.id || activeDetailProduct._id || '';
              const brandName =
                (typeof activeDetailProduct.brand === 'object'
                  ? (activeDetailProduct.brand as any)?.name
                  : activeDetailProduct.brand) || activeDetailProduct.name || 'Product';
              const coverImageObj =
                activeDetailProduct.images?.[0] || activeDetailProduct.variants?.[0]?.images?.[0];
              const coverUri = getImageUrl(coverImageObj);
              const detailCode = getProductDisplayCode(activeDetailProduct);
              const detailTotalStock = getProductTotalStock(activeDetailProduct);
              const isWh =
                activeDetailProduct.source === 'warehouse' ||
                !!activeDetailProduct.warehouseId ||
                !!activeDetailProduct.addedByOperator;
              const catName = getCategoryName(activeDetailProduct);
              const subCatName = getSubCategoryName(activeDetailProduct);
              const sizeSummaryList = getDetailSizeSummary(activeDetailProduct);
              const variantsToRender: ProductVariant[] =
                activeDetailProduct.variants && activeDetailProduct.variants.length > 0
                  ? activeDetailProduct.variants
                  : (activeDetailProduct as any).sizes?.length > 0
                  ? [
                      {
                        _id: 'default_var',
                        color: 'Default',
                        mrp: (activeDetailProduct as any).mrp || (activeDetailProduct as any).price || 0,
                        price: (activeDetailProduct as any).price || 0,
                        discount: 0,
                        images: activeDetailProduct.images || [],
                        sizes: (activeDetailProduct as any).sizes,
                      },
                    ]
                  : [];

              return (
                <ScrollView
                  style={styles.detailSheetScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                >
                  {/* Header Row */}
                  <View style={styles.detailHeaderRow}>
                    {coverUri ? (
                      <Image source={{ uri: coverUri }} style={styles.detailThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.detailPlaceholderThumb}>
                        <ImageIcon size={24} color="#94A3B8" />
                      </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={styles.detailProductName}>{brandName}</Text>
                        {detailCode ? (
                          <View style={styles.codeBadge}>
                            <Barcode size={10} color="#475569" style={{ marginRight: 3 }} />
                            <Text style={styles.codeBadgeText}>{detailCode}</Text>
                          </View>
                        ) : null}
                        {isWh ? (
                          <View style={styles.whBadge}>
                            <Text style={styles.whBadgeText}>Warehouse</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.detailProductMeta}>
                        {catName || 'Category'}
                        {subCatName ? ` • ${subCatName}` : ''}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.detailCloseBtn}
                      onPress={handleCloseDetailModal}
                    >
                      <X size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Stock Overview Strip */}
                  <View style={styles.detailStockOverviewRow}>
                    <View style={styles.totalStockPill}>
                      <Package size={12} color="#0F172A" style={{ marginRight: 5 }} />
                      <Text style={styles.totalStockText}>{detailTotalStock} units total</Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ alignItems: 'center', paddingRight: 12, gap: 6 }}
                      style={{ flex: 1 }}
                    >
                      {sizeSummaryList.map((szItem, sIdx) => (
                        <View
                          key={sIdx}
                          style={[
                            styles.sizeSummaryPill,
                            szItem.stock === 0 && styles.outOfStockPill,
                          ]}
                        >
                          <Text style={styles.sizeSummaryName}>{szItem.size}</Text>
                          <Text
                            style={[
                              styles.sizeSummaryStock,
                              szItem.stock === 0 && styles.outOfStockText,
                            ]}
                          >
                            : {szItem.stock}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Complete Variants & Sizes Breakdown */}
                  <View style={styles.variantsTitleContainer}>
                    <Text style={styles.variantsTitle}>
                      VARIANTS & SIZES ({variantsToRender.length})
                    </Text>
                  </View>

                  {variantsToRender.map((variant, index) => {
                    const varId = variant._id || String(index);
                    const colorObj =
                      typeof variant.color === 'object'
                        ? variant.color
                        : { name: variant.color || 'Default', hex: '#000000' };

                    return (
                      <View key={varId} style={styles.variantContainer}>
                        <View style={styles.variantHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {colorObj.hex ? (
                              <View style={[styles.colorDot, { backgroundColor: colorObj.hex }]} />
                            ) : null}
                            <Text style={styles.variantColor}>{colorObj.name || 'Default'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.variantPrice}>
                              ₹{variant.price || 0}{' '}
                              <Text style={styles.mrpText}>₹{variant.mrp || 0}</Text>
                            </Text>
                            <TouchableOpacity
                              style={styles.pricePenBtn}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => {
                                const targetProd = activeDetailProduct;
                                setSelectedDetailProduct(null);
                                setReopenDetailId(prodId);
                                handleOpenPriceModal(targetProd, variant);
                              }}
                            >
                              <Edit3 size={13} color="#2563EB" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteVariant(prodId, varId)}
                              style={styles.deleteVariantBtn}
                            >
                              <Trash2 size={15} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* All Sizes & Stock for this Variant */}
                        <View style={styles.variantSizesWrap}>
                          <Text style={styles.variantSizesLabel}>
                            Sizes & Stock ({variant.sizes?.length || 0}):
                          </Text>
                          <View style={styles.variantSizesListCol}>
                            {(variant.sizes || []).map((sz, szIdx) => {
                              const sizeKey = `${varId}_${sz._id || sz.size}`;
                              const isEditing = editingSizeKey === sizeKey;
                              const isSaving = savingSizeId === sizeKey;

                              if (isEditing) {
                                return (
                                  <View key={sz._id || szIdx} style={styles.sizeStockEditCard}>
                                    <View style={styles.sizeStockLeft}>
                                      <View style={[styles.sizeNameBadge, styles.sizeNameBadgeActive]}>
                                        <Text style={[styles.sizeNameBadgeText, styles.sizeNameBadgeTextActive]}>
                                          {sz.size}
                                        </Text>
                                      </View>
                                      {sz.merchantSizeCode || sz.sizeCode ? (
                                        <Text style={styles.sizeCodeLabel} numberOfLines={1}>
                                          ({sz.merchantSizeCode || sz.sizeCode})
                                        </Text>
                                      ) : null}
                                    </View>

                                    <View style={styles.sizeStockEditControls}>
                                      <TouchableOpacity
                                        style={styles.stepBtn}
                                        onPress={() => {
                                          const current = parseInt(editingStockVal, 10) || 0;
                                          setEditingStockVal(String(Math.max(0, current - 1)));
                                        }}
                                      >
                                        <Minus size={13} color="#0F172A" />
                                      </TouchableOpacity>

                                      <TextInput
                                        style={styles.stepInput}
                                        keyboardType="number-pad"
                                        value={editingStockVal}
                                        onChangeText={(val) => setEditingStockVal(val.replace(/[^0-9]/g, ''))}
                                        selectTextOnFocus
                                      />

                                      <TouchableOpacity
                                        style={styles.stepBtn}
                                        onPress={() => {
                                          const current = parseInt(editingStockVal, 10) || 0;
                                          setEditingStockVal(String(current + 1));
                                        }}
                                      >
                                        <Plus size={13} color="#0F172A" />
                                      </TouchableOpacity>

                                      <TouchableOpacity
                                        style={[styles.saveStepBtn, isSaving && { opacity: 0.6 }]}
                                        disabled={isSaving}
                                        onPress={() => handleSaveSingleSize(activeDetailProduct, variant, sz)}
                                      >
                                        {isSaving ? (
                                          <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                          <Check size={14} color="#FFFFFF" />
                                        )}
                                      </TouchableOpacity>

                                      <TouchableOpacity
                                        style={styles.cancelStepBtn}
                                        disabled={isSaving}
                                        onPress={() => setEditingSizeKey(null)}
                                      >
                                        <X size={14} color="#64748B" />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                );
                              }

                              return (
                                <View key={sz._id || szIdx} style={styles.sizeStockRowCard}>
                                  <View style={styles.sizeStockLeft}>
                                    <View style={styles.sizeNameBadge}>
                                      <Text style={styles.sizeNameBadgeText}>{sz.size}</Text>
                                    </View>
                                    {sz.merchantSizeCode || sz.sizeCode ? (
                                      <Text style={styles.sizeCodeLabel} numberOfLines={1}>
                                        ({sz.merchantSizeCode || sz.sizeCode})
                                      </Text>
                                    ) : null}
                                  </View>

                                  <View style={styles.sizeStockRight}>
                                    <View
                                      style={[
                                        styles.sizeStockPill,
                                        sz.stock === 0
                                          ? styles.sizeStockPillOut
                                          : sz.stock <= 3
                                          ? styles.sizeStockPillLow
                                          : styles.sizeStockPillIn,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.sizeStockPillText,
                                          sz.stock === 0
                                            ? styles.sizeStockPillTextOut
                                            : sz.stock <= 3
                                            ? styles.sizeStockPillTextLow
                                            : styles.sizeStockPillTextIn,
                                        ]}
                                      >
                                        {sz.stock === 0 ? '0' : `${sz.stock}`} in stock
                                      </Text>
                                    </View>

                                    <TouchableOpacity
                                      style={styles.sizePenBtn}
                                      activeOpacity={0.7}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      onPress={() => {
                                        setEditingSizeKey(sizeKey);
                                        setEditingStockVal(String(sz.stock ?? 0));
                                      }}
                                    >
                                      <Edit3 size={14} color="#2563EB" />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })}
                            {(!variant.sizes || variant.sizes.length === 0) && (
                              <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 4 }}>
                                No sizes configured
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {/* Actions: Add Color Variant & Edit Details */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      style={[styles.addVariantPillBtn, { flex: 1, marginTop: 0 }]}
                      onPress={() => {
                        handleCloseDetailModal();
                        router.push(`/add-variant?productId=${prodId}`);
                      }}
                    >
                      <Plus size={14} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.addVariantPillText}>Add Variant</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.editAllDetailsBtn, { flex: 1 }]}
                      onPress={() => {
                        handleCloseDetailModal();
                        router.push(`/edit-product?id=${prodId}`);
                      }}
                    >
                      <Settings size={14} color="#0F172A" style={{ marginRight: 6 }} />
                      <Text style={styles.editAllDetailsText}>Edit Full Details</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Sort Selection Modal */}
      <Modal visible={sortModalVisible} animationType="fade" transparent onRequestClose={() => setSortModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={styles.sortModalBox} onStartShouldSetResponder={() => true}>
            <View style={styles.sortModalHeader}>
              <Text style={styles.sortModalTitle}>Sort Products By</Text>
              <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {[
              { id: 'newest', label: '🆕 Newest First (Default)' },
              { id: 'price_asc', label: '💲 Price: Low to High' },
              { id: 'price_desc', label: '💲 Price: High to Low' },
              { id: 'name_asc', label: '🔤 Brand: A to Z' },
              { id: 'stock_desc', label: '📦 Stock: High to Low' },
            ].map((opt) => {
              const isSelected = sortBy === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.sortOptionRow, isSelected && styles.sortOptionRowActive]}
                  onPress={() => {
                    setSortBy(opt.id as any);
                    setSortModalVisible(false);
                  }}
                >
                  <Text style={[styles.sortOptionLabel, isSelected && styles.sortOptionLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Stock Editing Modal */}
      <Modal visible={stockModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage Inventory Sizes</Text>
            {selectedProduct && selectedVariant && (
              <Text style={styles.modalSubtitle}>
                {(typeof selectedProduct.brand === 'object' ? (selectedProduct.brand as any)?.name : selectedProduct.brand) || 'Product'} - {typeof selectedVariant.color === 'object' ? (selectedVariant.color as any)?.name || '' : selectedVariant.color}
              </Text>
            )}

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              {sizeList.map((row, index) => (
                <View key={index} style={styles.modalFormRow}>
                  <View style={{ flex: 1.1 }}>
                    <Text style={styles.inputLabel}>Size *</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={row.size}
                      placeholder="Size"
                      placeholderTextColor="#94A3B8"
                      onChangeText={(val) => {
                        const updated = [...sizeList];
                        updated[index].size = val;
                        setSizeList(updated);
                      }}
                    />
                  </View>

                  <View style={{ flex: 1.3 }}>
                    <Text style={styles.inputLabel}>Code / SKU</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={row.sizeCode || ''}
                      placeholder="e.g. S-01"
                      placeholderTextColor="#94A3B8"
                      onChangeText={(val) => {
                        const updated = [...sizeList];
                        updated[index].sizeCode = val;
                        setSizeList(updated);
                      }}
                    />
                  </View>

                  <View style={{ flex: 2.1 }}>
                    <Text style={styles.inputLabel}>Stock</Text>
                    <View style={styles.modalStockCounterRow}>
                      <TouchableOpacity
                        style={styles.modalCounterBtn}
                        onPress={() => {
                          const current = parseInt(row.stock, 10) || 0;
                          const updated = [...sizeList];
                          updated[index].stock = Math.max(0, current - 1).toString();
                          setSizeList(updated);
                        }}
                      >
                        <Minus size={13} color="#0F172A" />
                      </TouchableOpacity>

                      <TextInput
                        style={[styles.modalInput, styles.modalStockInput]}
                        value={row.stock}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        onChangeText={(val) => {
                          const updated = [...sizeList];
                          updated[index].stock = val;
                          setSizeList(updated);
                        }}
                      />

                      <TouchableOpacity
                        style={styles.modalCounterBtn}
                        onPress={() => {
                          const current = parseInt(row.stock, 10) || 0;
                          const updated = [...sizeList];
                          updated[index].stock = (current + 1).toString();
                          setSizeList(updated);
                        }}
                      >
                        <Plus size={13} color="#0F172A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteRowBtn}
                    onPress={() => handleRemoveSizeRow(index)}
                  >
                    <Trash2 size={17} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addRowBtn} onPress={handleAddSizeRow}>
                <Plus size={16} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.addRowText}>Add Size Row</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setStockModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleSaveStock}
              >
                <Text style={styles.modalSaveText}>Save Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pricing Editing Modal */}
      <Modal visible={priceModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage Variant Price</Text>
            {selectedProduct && selectedVariant && (
              <Text style={styles.modalSubtitle}>
                {(typeof selectedProduct.brand === 'object' ? (selectedProduct.brand as any)?.name : selectedProduct.brand) || 'Product'} - {typeof selectedVariant.color === 'object' ? (selectedVariant.color as any)?.name || '' : selectedVariant.color}
              </Text>
            )}

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <View style={styles.modalInputWrapper}>
                <Text style={styles.inputLabel}>MRP (Maximum Retail Price)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={mrpInput}
                  keyboardType="numeric"
                  placeholder="e.g. 1299"
                  placeholderTextColor="#94A3B8"
                  onChangeText={setMrpInput}
                />
              </View>

              <View style={[styles.modalInputWrapper, { marginTop: 12 }]}>
                <Text style={styles.inputLabel}>Selling Price</Text>
                <TextInput
                  style={styles.modalInput}
                  value={priceInput}
                  keyboardType="numeric"
                  placeholder="e.g. 999"
                  placeholderTextColor="#94A3B8"
                  onChangeText={setPriceInput}
                />
              </View>

              <View style={[styles.modalInputWrapper, { marginTop: 12 }]}>
                <Text style={styles.inputLabel}>Discount (%)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={discountInput}
                  keyboardType="numeric"
                  placeholder="e.g. 15"
                  placeholderTextColor="#94A3B8"
                  onChangeText={setDiscountInput}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setPriceModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleSavePrice}
              >
                <Text style={styles.modalSaveText}>Save Price</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Filter Button (Always Accessible while scrolling) */}
      <TouchableOpacity
        style={styles.floatingFilterFab}
        onPress={() => setFilterModalVisible(true)}
        activeOpacity={0.85}
      >
        <Filter size={17} color="#FFFFFF" />
        <Text style={styles.floatingFilterFabText}>Filter</Text>
        {activeFilterCount > 0 ? (
          <View style={styles.floatingFabBadge}>
            <Text style={styles.floatingFabBadgeText}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Comprehensive Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            {/* Modal Header */}
            <View style={styles.filterModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Filter size={18} color="#0F172A" />
                <Text style={styles.filterModalTitle}>Filter Products</Text>
                {activeFilterCount > 0 ? (
                  <View style={styles.filterActiveBadge}>
                    <Text style={styles.filterActiveBadgeText}>{activeFilterCount} Active</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {activeFilterCount > 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCategoryFilter('All');
                      setSelectedSubCategoryFilter('All');
                      setStatusFilter('ALL');
                      setSortBy('newest');
                    }}
                  >
                    <Text style={styles.resetFilterText}>Reset All</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Stock Status Section */}
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.filterSectionTitle}>STOCK STATUS</Text>
                <View style={styles.statusGrid}>
                  {[
                    { id: 'ALL', label: `All (${products.length})` },
                    { id: 'IN_STOCK', label: `In Stock (${stockCounts.inStock})` },
                    { id: 'LOW_STOCK', label: `Low Stock ≤5 (${stockCounts.lowStock})` },
                    { id: 'OUT_OF_STOCK', label: `Out of Stock (${stockCounts.outOfStock})` },
                  ].map((item) => {
                    const isSel = statusFilter === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.statusOptionPill, isSel && styles.statusOptionPillActive]}
                        onPress={() => setStatusFilter(item.id as any)}
                      >
                        <Text style={[styles.statusOptionText, isSel && styles.statusOptionTextActive]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Categories Section */}
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.filterSectionTitle}>CATEGORIES</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {categoriesList.map((cat) => {
                    const isSel = selectedCategoryFilter === cat;
                    const count = cat === 'All' ? products.length : (categoryCounts[cat] || 0);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catFilterChip, isSel && styles.catFilterChipActive]}
                        onPress={() => {
                          setSelectedCategoryFilter(cat);
                          if (cat !== selectedCategoryFilter) {
                            setSelectedSubCategoryFilter('All');
                          }
                        }}
                      >
                        <Text style={[styles.catFilterChipText, isSel && styles.catFilterChipTextActive]}>
                          {cat} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Subcategories Section */}
              <View style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={styles.filterSectionTitle}>
                    SUBCATEGORIES {selectedCategoryFilter !== 'All' ? `(${selectedCategoryFilter})` : ''}
                  </Text>
                  {selectedSubCategoryFilter !== 'All' && (
                    <TouchableOpacity onPress={() => setSelectedSubCategoryFilter('All')}>
                      <Text style={styles.resetFilterText}>Reset Subcategory</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {subCategoriesList.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 4 }}>
                    No subcategories available{selectedCategoryFilter !== 'All' ? ` for ${selectedCategoryFilter}` : ''}.
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {subCategoriesList.map((subCat) => {
                      const isSel = selectedSubCategoryFilter === subCat;
                      const count = subCat === 'All'
                        ? (selectedCategoryFilter === 'All' ? products.length : (categoryCounts[selectedCategoryFilter] || 0))
                        : (subCategoryCounts[subCat] || 0);
                      return (
                        <TouchableOpacity
                          key={subCat}
                          style={[styles.catFilterChip, isSel && styles.catFilterChipActive]}
                          onPress={() => setSelectedSubCategoryFilter(subCat)}
                        >
                          <Text style={[styles.catFilterChipText, isSel && styles.catFilterChipTextActive]}>
                            {subCat} ({count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Sort By Section */}
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.filterSectionTitle}>SORT ORDER</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { id: 'newest', label: '🆕 Newest First' },
                    { id: 'price_asc', label: '💲 Price: Low to High' },
                    { id: 'price_desc', label: '💲 Price: High to Low' },
                    { id: 'stock_desc', label: '📦 Stock: High to Low' },
                    { id: 'name_asc', label: '🔤 Brand: A to Z' },
                  ].map((opt) => {
                    const isSel = sortBy === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.catFilterChip, isSel && styles.catFilterChipActive]}
                        onPress={() => setSortBy(opt.id as any)}
                      >
                        <Text style={[styles.catFilterChipText, isSel && styles.catFilterChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>
                  {processedProducts.length === 0
                    ? '0 Matching Products'
                    : `Show ${processedProducts.length} ${processedProducts.length === 1 ? 'Product' : 'Products'}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  listContainer: {
    paddingVertical: 10,
    paddingBottom: 60,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1.5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    marginBottom: 12,
  },
  productHeaderThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  placeholderHeaderThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  productMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
    gap: 16,
  },
  switchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  switchLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  variantsTitleContainer: {
    marginBottom: 10,
  },
  variantsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  variantContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  variantColor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  variantPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  mrpText: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 10,
  },
  variantImage: {
    width: 64,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addPhotoBtn: {
    width: 64,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  sizesSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  sizesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  sizeStockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 140,
    flex: 1,
  },
  sizeHeaderCol: {
    marginRight: 8,
  },
  sizeBadgeName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  sizeCodeSub: {
    fontSize: 10,
    color: '#64748B',
  },
  stockBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  stockCountNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  stockCountUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  variantActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  manageStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  manageStockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  deleteVariantBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    fontWeight: '600',
  },
  modalForm: {
    marginBottom: 16,
  },
  modalFormRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 8,
  },
  modalInputWrapper: {
    width: '100%',
  },
  sizeInputContainer: {
    flex: 2,
  },
  stockInputContainer: {
    flex: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#1A1A1A',
  },
  modalStockCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalCounterBtn: {
    width: 30,
    height: 42,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStockInput: {
    flex: 1,
    minWidth: 40,
    paddingHorizontal: 2,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  deleteRowBtn: {
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 15,
  },
  modalSaveBtn: {
    backgroundColor: '#1A1A1A',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteProductCardBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  editDetailsBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addVariantPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 6,
    gap: 6,
  },
  addVariantPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  whBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  whBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '600',
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  expandAllText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  cardHeaderTouchable: {
    paddingBottom: 2,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  chevronBtn: {
    padding: 4,
    marginLeft: 6,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  quickEditStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  quickEditStockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalStockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  totalStockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  sizeSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  outOfStockPill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  sizeSummaryName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  sizeSummaryCode: {
    fontSize: 9,
    color: '#64748B',
    marginLeft: 2,
  },
  sizeSummaryStock: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    marginLeft: 2,
  },
  outOfStockText: {
    color: '#DC2626',
  },
  variantSizesWrap: {
    marginTop: 8,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  variantSizesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  variantSizesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  expandedContentContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  collapseFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  collapseFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  searchFilterWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInputField: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  sortBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipItemActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipItemTextActive: {
    color: '#FFFFFF',
  },
  loadMoreBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  endOfListContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  sortModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 360,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sortModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sortOptionRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  sortOptionRowActive: {
    backgroundColor: '#0F172A',
  },
  sortOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  sortOptionLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  floatingFilterFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  floatingFilterFabText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  floatingFabBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  floatingFabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  filterActiveBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  filterActiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  resetFilterText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOptionPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusOptionPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  catFilterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catFilterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  catFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterModalFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filterApplyBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  subFilterChipItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  subFilterChipItemActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  subFilterChipItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  subFilterChipItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Column Toggle
  gridToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  gridToggleBtnActive: {
    backgroundColor: '#0F172A',
  },
  gridToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  gridToggleTextActive: {
    color: '#FFFFFF',
  },
  // Pure Product Cards
  gridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  gridCodeBar: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  gridCodeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  gridImageContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  gridWhBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  gridWhBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  gridStockBar: {
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridStockBarIn: {
    backgroundColor: '#ECFDF5',
  },
  gridStockBarLow: {
    backgroundColor: '#FEF3C7',
  },
  gridStockBarOut: {
    backgroundColor: '#FEF2F2',
  },
  gridStockText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  gridStockTextIn: {
    color: '#059669',
    fontSize: 9,
  },
  gridStockTextLow: {
    color: '#D97706',
    fontSize: 9,
  },
  gridStockTextOut: {
    color: '#DC2626',
    fontSize: 8.5,
  },
  gridSizesContainer: {
    paddingHorizontal: 3,
    paddingVertical: 3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 20,
  },
  gridSizesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridSizePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 3.5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  gridSizePillOut: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  gridSizePillText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#334155',
  },
  gridSizePillTextOut: {
    color: '#DC2626',
  },
  gridNoSizesText: {
    fontSize: 8.5,
    color: '#94A3B8',
    textAlign: 'center',
  },
  // Slide-up Detail Bottom Sheet
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  detailModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  detailSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  detailSheetScroll: {
    marginTop: 4,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  detailPlaceholderThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailProductName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailProductMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  detailCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  detailStockOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  editAllDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  editAllDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  variantSizesListCol: {
    gap: 6,
    marginTop: 4,
  },
  sizeStockRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sizeStockEditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  sizeStockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sizeNameBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  sizeNameBadgeActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  sizeNameBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  sizeNameBadgeTextActive: {
    color: '#FFFFFF',
  },
  sizeCodeLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    flexShrink: 1,
  },
  sizeStockRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeStockPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sizeStockPillIn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  sizeStockPillLow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  sizeStockPillOut: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  sizeStockPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sizeStockPillTextIn: {
    color: '#059669',
  },
  sizeStockPillTextLow: {
    color: '#D97706',
  },
  sizeStockPillTextOut: {
    color: '#DC2626',
  },
  sizePenBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeStockEditControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    width: 44,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
  saveStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPriceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 2,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#F1F5F9',
  },
  gridPriceText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  gridMrpText: {
    fontSize: 8.5,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  pricePenBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
