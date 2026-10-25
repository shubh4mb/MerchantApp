import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../utils/api';
import { Check, Package, Tag, Layers, DollarSign, Activity, Settings, X, Plus, Camera, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Link as LinkIcon, Download } from 'lucide-react-native';
import { downloadAndSaveImage, downloadAndSaveMultipleImages } from '../utils/imageDownloader';
import { getMerchantEnteredSku } from '../utils/skuUtils';

interface Category {
  _id: string;
  name: string;
  level: number;
  parentId?: string;
  isActive?: boolean;
}

interface DynamicAttribute {
  _id: string;
  name: string;
  slug: string;
  inputType: 'select' | 'multiselect' | 'text' | 'number' | 'boolean';
  isRequired: boolean;
  values?: { label: string; value: string }[];
}

interface Collection {
  _id: string;
  name: string;
  description?: string;
}

export default function EditProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  // Loaders
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isWarehouseProduct, setIsWarehouseProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Metadata Lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [dynamicAttributes, setDynamicAttributes] = useState<DynamicAttribute[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [soldBy, setSoldBy] = useState('');
  const [styleName, setStyleName] = useState('');
  const [description, setDescription] = useState('');
  
  // New States for expanded fields
  const [isActive, setIsActive] = useState(true);
  const [isTriable, setIsTriable] = useState(true);
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>([]);
  const [selectedSecParent, setSelectedSecParent] = useState<string>('');
  const [selectedSecSub, setSelectedSecSub] = useState<string>('');
  const [genderSelection, setGenderSelection] = useState<string[]>([]);
  const [rawProduct, setRawProduct] = useState<any>(null);
  
  // UI toggles for dropdowns
  const [showParentCategories, setShowParentCategories] = useState(false);
  const [showSubCategories, setShowSubCategories] = useState(false);
  const [showSecParentDropdown, setShowSecParentDropdown] = useState(false);
  const [showSecSubDropdown, setShowSecSubDropdown] = useState(false);
  const [expandedAttributeId, setExpandedAttributeId] = useState<string | null>(null);

  // Pricing & Stock
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  
  // Sizes array & Images
  const [sizes, setSizes] = useState<{ _id?: string; size: string; merchantSizeCode: string; stock: string }[]>([]);
  const [selectedImages, setSelectedImages] = useState<{ uri: string; isNew: boolean; _id?: string }[]>([]);

  // Advanced fields
  const [attributes, setAttributes] = useState<{ attributeId: string; value: any }[]>([]);
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  // Key Feature Form
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [showFeatureForm, setShowFeatureForm] = useState(false);

  const [error, setError] = useState('');

  // Fetch initial product and metadata
  useEffect(() => {
    if (!id) return;

    const loadAllDetails = async () => {
      try {
        setLoading(true);

        // Fetch categories & collections
        const [catRes, colRes] = await Promise.all([
            api.get('/merchant/getCategories'),
            api.get('/merchant/collections')
        ]);
        
        setCategories(catRes.data?.categories || catRes.data || []);
        setCollections(colRes.data?.collections || colRes.data || []);

        // Fetch base product details
        const prodRes = await api.get(`/merchant/getBaseProductById/${id}`);
        const prod = prodRes.data?.product || prodRes.data || {};

        if (prod.source === 'warehouse' || prod.warehouseId || prod.addedByOperator) {
          setIsWarehouseProduct(true);
        }

        setName(prod.name || '');
        setSoldBy(prod.soldBy || prod.brand || '');
        setStyleName(prod.styleName || '');
        setDescription(prod.description || '');
        setIsTriable(!!prod.isTriable);
        setIsActive(prod.isActive !== false);
        setGenderSelection(prod.gender || []);
        setFeatures(prod.features || {});
        // Normalize attributes so attributeId is always a plain string ID
        const rawAttrs = prod.attributes || [];
        const normalizedAttrs = rawAttrs.map((a: any) => ({
          attributeId: String(a.attributeId?._id || a.attributeId || a.attribute?._id || a.attribute || ''),
          value: a.value
        }));
        setAttributes(normalizedAttrs);
        setTags((prod.tags || []).join(', '));
        
        // Populate new fields
        setMrp(prod.mrp ? String(prod.mrp) : '');
        setPrice(prod.price ? String(prod.price) : '');
        setDiscount(prod.discount ? String(prod.discount) : '0');
        
        // Populate sizes array
        if (prod.sizes && prod.sizes.length > 0) {
            setSizes(prod.sizes.map((s: any) => {
                const rawCode = s.merchantSizeCode || s.productCode || '';
                const clean = getMerchantEnteredSku(rawCode, s.merchantSizeCode, [s]);
                return {
                    _id: s._id,
                    size: s.size || '',
                    merchantSizeCode: clean !== '—' ? clean : (s.merchantSizeCode || ''),
                    stock: String(s.stock || 0)
                };
            }));
        } else {
            const rawCode = prod.merchantSizeCode || prod.productCode || '';
            const clean = getMerchantEnteredSku(rawCode, prod.merchantSizeCode);
            setSizes([{
                size: prod.size || '',
                merchantSizeCode: clean !== '—' ? clean : (prod.merchantSizeCode || ''),
                stock: String(prod.stock || 0)
            }]);
        }

        // Populate images array
        if (prod.images && prod.images.length > 0) {
            setSelectedImages(prod.images.map((img: any) => ({
                uri: img.url || img,
                isNew: false,
                _id: img._id
            })));
        }

        // Extract assigned collections
        const assignedCols = (prod.collectionIds || []).map((c: any) => c._id || c);
        setSelectedCollections(assignedCols);
        
        setRawProduct(prod);
        const rawAddCats = prod.additionalCategoryIds || prod.additionalCategories || [];
        const normalizedAddCats = Array.isArray(rawAddCats)
          ? rawAddCats.map((c: any) => typeof c === 'object' ? (c._id || c.id) : String(c)).filter(Boolean)
          : [];
        setAdditionalCategoryIds(normalizedAddCats);

        const catId = prod.categoryId?._id || prod.categoryId;
        if (catId) setSelectedParentCategory(String(catId));

        // Fetch specs if subCategory exists
        const subCatId = prod.subCategoryId?._id || prod.subCategoryId;
        if (subCatId) {
          setSelectedSubCategory(String(subCatId));
          const attrRes = await api.get(`/merchant/attributes`, {
            params: { categoryId: subCatId },
          });
          setDynamicAttributes(attrRes.data?.attributes || []);
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
        Alert.alert('Error', 'Failed to retrieve product details.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadAllDetails();
  }, [id]);

  // Robust category sync: Ensures selectedParentCategory and selectedSubCategory always match valid categories in state
  useEffect(() => {
    if (!rawProduct || categories.length === 0) return;
    const normStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Resolve Main Category ID if not matching an active category _id
    let resolvedParentId = selectedParentCategory;
    const parentMatch = categories.find((c) => String(c._id) === String(resolvedParentId));
    if (!parentMatch) {
      const rawCatId = String(rawProduct.categoryId?._id || rawProduct.categoryId || '');
      const rawCatName = rawProduct.category || '';
      const matchedParent = categories.find(
        (c) =>
          (c.level === 0 || !c.parentId) &&
          ((rawCatId && String(c._id) === rawCatId) ||
           (rawCatName && normStr(c.name) === normStr(rawCatName)))
      );
      if (matchedParent) {
        resolvedParentId = matchedParent._id;
        setSelectedParentCategory(matchedParent._id);
      }
    }

    // 2. Resolve Sub Category ID if not matching an active subcategory _id
    const subMatch = categories.find((c) => String(c._id) === String(selectedSubCategory));
    if (!subMatch) {
      const rawSubId = String(rawProduct.subCategoryId?._id || rawProduct.subCategoryId || '');
      const rawSubName = rawProduct.subCategory || '';
      const matchedSub = categories.find((c) => {
        const parentIdStr = String((c.parentId as any)?._id || c.parentId || '');
        const matchesParent = resolvedParentId ? parentIdStr === String(resolvedParentId) : true;
        return (
          matchesParent &&
          ((rawSubId && String(c._id) === rawSubId) ||
           (rawSubName && normStr(c.name) === normStr(rawSubName)))
        );
      });
      if (matchedSub) {
        setSelectedSubCategory(matchedSub._id);
        if (!resolvedParentId && matchedSub.parentId) {
          const pId = String((matchedSub.parentId as any)?._id || matchedSub.parentId);
          setSelectedParentCategory(pId);
        }
      }
    }
  }, [categories, rawProduct, selectedParentCategory, selectedSubCategory]);
  
  // Re-fetch dynamic attributes when sub-category changes manually
  useEffect(() => {
    const fetchAttributes = async () => {
      if (!selectedSubCategory) {
        setDynamicAttributes([]);
        return;
      }
      try {
        const res = await api.get('/merchant/attributes', {
          params: { categoryId: selectedSubCategory },
        });
        setDynamicAttributes(res.data?.attributes || []);
      } catch (err) {
        console.error('Failed to fetch dynamic attributes:', err);
      }
    };
    // Only re-fetch if not initial load
    if (!loading) fetchAttributes();
  }, [selectedSubCategory]);

  const handleGenderToggle = (gender: string) => {
    if (genderSelection.includes(gender)) {
      setGenderSelection(genderSelection.filter((g) => g !== gender));
    } else {
      setGenderSelection([...genderSelection, gender]);
    }
  };

  const handleToggleCollection = (colId: string) => {
    if (selectedCollections.includes(colId)) {
      setSelectedCollections(selectedCollections.filter((cId) => cId !== colId));
    } else {
      setSelectedCollections([...selectedCollections, colId]);
    }
  };

  const handleAddFeature = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    setFeatures((prev) => ({
      ...prev,
      [newKey.trim()]: newVal.trim(),
    }));
    setNewKey('');
    setNewVal('');
    setShowFeatureForm(false);
  };

  const handleRemoveFeature = (key: string) => {
    setFeatures((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleAttributeChange = (attributeId: string, val: any, isMultiselect: boolean = false) => {
    setAttributes((prev) => {
      // Robust ID extraction
      const getId = (a: any) => String(a.attributeId || a.attribute || (a.attributeId && a.attributeId._id) || (a.attribute && a.attribute._id));
      
      let updated = prev.filter((a) => getId(a) !== String(attributeId));
      const existing = prev.find((a) => getId(a) === String(attributeId));

      if (isMultiselect) {
          let currentValues = existing ? existing.value : [];
          if (!Array.isArray(currentValues)) currentValues = [currentValues].filter(Boolean);

          if (currentValues.includes(val)) {
            currentValues = currentValues.filter((v: any) => v !== val);
          } else {
            currentValues.push(val);
          }

          if (currentValues.length > 0) {
            updated.push({ attributeId, value: currentValues });
          }
      } else {
          // Single select toggle or boolean
          if (existing && String(existing.value) === String(val)) {
            // Toggle off if they click the same thing again
            // Omit pushing back to updated
          } else if (val !== '' && val !== false && val !== undefined) {
            updated.push({ attributeId, value: val });
          }
      }
      return updated;
    });
  };

  const handleAddSizeRow = () => {
    setSizes([...sizes, { size: '', merchantSizeCode: '', stock: '0' }]);
  };

  const handleRemoveSizeRow = (index: number) => {
    setSizes(sizes.filter((_, idx) => idx !== index));
  };

  const handlePickPhoto = async () => {
    if (selectedImages.length >= 4) {
      Alert.alert('Limit Reached', 'Maximum 4 images allowed.');
      return;
    }

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraPermission.granted || !galleryPermission.granted) {
      Alert.alert('Permission Denied', 'Camera and Photo Library access is required.');
      return;
    }

    Alert.alert(
      'Upload Photo',
      'Choose image source:',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.4,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              uploadNewImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.4,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              uploadNewImage(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedImages.length) return;
    const updated = [...selectedImages];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setSelectedImages(updated);
  };

  const handleDeleteProduct = () => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${name || 'this product'}" and all its variations? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await api.delete(`/merchant/deleteProduct/${id}`);
              Alert.alert('Success', 'Product deleted successfully.', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/products') }
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to delete product.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const uploadNewImage = async (uri: string) => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('images', {
        uri,
        name: filename,
        type,
      } as any);
      formData.append('productId', id as string);
      formData.append('variantIndex', '0');

      const res = await api.post('/merchant/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data?.images && Array.isArray(res.data.images)) {
        setSelectedImages(res.data.images.map((img: any) => ({
          uri: img.url || img,
          isNew: false,
          _id: img._id,
          public_id: img.public_id
        })));
      } else {
        setSelectedImages([...selectedImages, { uri, isNew: true }]);
      }
      Alert.alert('Success', 'Photo uploaded successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.response?.data?.message || 'Server error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    const img = selectedImages[index];
    if (!img.isNew && img._id) {
        try {
            await api.delete(`/merchant/deleteImage/${img._id}`);
        } catch (err) {
            console.error('Failed to delete remote image', err);
        }
    }
    setSelectedImages(selectedImages.filter((_, idx) => idx !== index));
  };

  const handleDownloadSinglePhoto = async (uri: string, index: number) => {
    const base = name || styleName || 'product';
    const filename = `${base}_photo_${index + 1}.jpg`;
    const ok = await downloadAndSaveImage(uri, filename);
    if (ok) {
      Alert.alert('Saved!', 'Photo saved to your phone gallery.');
    }
  };

  const handleDownloadAllPhotos = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Photos', 'No photos available to download.');
      return;
    }
    const base = name || styleName || 'product';
    const uris = selectedImages.map((img) => img.uri).filter(Boolean);
    Alert.alert('Downloading...', `Saving ${uris.length} photos to your gallery. Please wait.`);
    const res = await downloadAndSaveMultipleImages(uris, base);
    if (res.successCount > 0) {
      Alert.alert('Success!', `Saved ${res.successCount} of ${res.total} photos to your photo gallery.`);
    }
  };

  const handleSaveChanges = async () => {
    if (!price || parseFloat(price) <= 0) {
      setError('Please enter a valid Selling Price.');
      return;
    }

    if (!selectedParentCategory) {
      setError('Please select a Main Category.');
      return;
    }

    if (!selectedSubCategory) {
      setError('Please select a Sub Category. Subcategory is mandatory.');
      return;
    }

    const parsedPrice = parseFloat(price) || 0;
    let parsedMrp = parseFloat(mrp) || 0;
    if (parsedMrp <= 0 || parsedMrp < parsedPrice) {
      parsedMrp = parsedPrice;
    }
    const parsedDiscount = parsedMrp > 0 ? Math.round(((parsedMrp - parsedPrice) / parsedMrp) * 100) : 0;

    const parsedSizes = sizes
    .filter((s) => s.size.trim() !== '')
    .map((s) => ({
        _id: s._id,
        size: s.size.trim(),
        merchantSizeCode: s.merchantSizeCode.trim(),
        stock: parseInt(s.stock) || 0,
    }));

    if (parsedSizes.length === 0) {
        setError('Please add at least one valid size with stock.');
        return;
    }

    const finalName = name.trim() || styleName.trim() || 'New Product';
    const finalSoldBy = soldBy.trim() || 'Store';
    const finalGender = genderSelection.length > 0 ? genderSelection : ['MEN', 'WOMEN'];

    setError('');
    setSaving(true);

    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const cleanAttributes = (attributes || []).filter(a => {
        if (a.value === undefined || a.value === null || a.value === '') return false;
        if (Array.isArray(a.value) && a.value.length === 0) return false;
        return true;
      });

      const payload = {
        name: finalName,
        soldBy: finalSoldBy,
        styleName: styleName.trim(),
        description: description.trim(),
        categoryId: selectedParentCategory,
        subCategoryId: selectedSubCategory,
        additionalCategoryIds: additionalCategoryIds,
        isTriable,
        isActive,
        gender: finalGender,
        features,
        attributes: cleanAttributes,
        tags: parsedTags,
        collectionIds: selectedCollections,
        mrp: parsedMrp,
        price: parsedPrice,
        discount: Math.max(0, parsedDiscount),
        images: selectedImages.map((img: any) => ({
          url: img.uri,
          public_id: img.public_id || '',
          _id: img._id || undefined
        })),
        sizes: parsedSizes
      };

      await api.patch(`/merchant/editProduct/${id}`, payload);

      Alert.alert('Success', 'Product details updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const parentCategories = categories.filter((c) => c.level === 0 && (c.isActive !== false));
  const subCategories = categories.filter(
    (c) => c.level === 1 && String((c.parentId as any)?._id || c.parentId) === String(selectedParentCategory) && (c.isActive !== false)
  );
  const secSubCategories = categories.filter(
    (c) => c.level === 1 && String((c.parentId as any)?._id || c.parentId) === String(selectedSecParent) && (c.isActive !== false)
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E293B" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {isWarehouseProduct ? (
          <View style={styles.warehouseWarningBox}>
            <Text style={styles.warehouseWarningTitle}>📦 FlashFits Warehouse Product</Text>
            <Text style={styles.warehouseWarningSub}>
              This product is stored in a FlashFits central warehouse. Updates made here will directly sync to the live store.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 1. Status & Basic Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Package size={20} color="#1E293B" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Basic Information</Text>
          </View>

          <View style={styles.toggleRowCompact}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Activity size={16} color={isActive ? '#10B981' : '#64748B'} style={{ marginRight: 8 }} />
                <Text style={styles.toggleRowText}>{isActive ? 'Product is Active' : 'Product is Inactive'}</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              disabled={saving}
              thumbColor={isActive ? '#1A1A1A' : '#E2E8F0'}
              trackColor={{ true: '#1A1A1A50', false: '#CBD5E1' }}
            />
          </View>

          <Text style={styles.label}>Product Name <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(Optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Product Name"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            editable={!saving}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Product description..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            editable={!saving}
          />
          
          <Text style={styles.label}>Matching Products</Text>
          <TouchableOpacity 
            style={[styles.dropdownToggle, { justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => router.push(`/matching-products?id=${id}`)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LinkIcon size={16} color="#64748B" style={{ marginRight: 8 }} />
              <Text style={styles.dropdownToggleText}>Set Matching Products</Text>
            </View>
            <ChevronDown size={20} color="#64748B" style={{ transform: [{ rotate: '-90deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* 2. Categorization & Gender */}
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Layers size={20} color="#1E293B" style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Categorization & Gender</Text>
            </View>
            
            <Text style={styles.label}>Main Category * {!selectedParentCategory && <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>(Required)</Text>}</Text>
            <TouchableOpacity 
                style={styles.dropdownToggle} 
                onPress={() => setShowParentCategories(!showParentCategories)}
            >
                <Text style={styles.dropdownToggleText}>
                    {selectedParentCategory 
                        ? (categories.find((c) => String(c._id) === String(selectedParentCategory))?.name || 'Select Main Category')
                        : 'Select Main Category'}
                </Text>
                {showParentCategories ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
            </TouchableOpacity>

            {showParentCategories && (
                <View style={styles.multiselectContainer}>
                    {parentCategories.map((cat) => {
                    const isSelected = String(selectedParentCategory) === String(cat._id);
                    return (
                        <TouchableOpacity
                            key={cat._id}
                            style={[styles.chip, isSelected && styles.chipSelected, { marginBottom: 4 }]}
                            onPress={() => {
                                setSelectedParentCategory(cat._id);
                                setSelectedSubCategory('');
                                setShowParentCategories(false);
                            }}
                            disabled={saving}
                        >
                        {isSelected && <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {cat.name}
                        </Text>
                        </TouchableOpacity>
                    );
                    })}
                </View>
            )}
            
            {selectedParentCategory ? (
                <>
                <Text style={styles.label}>Sub Category * {!selectedSubCategory && <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>(Required)</Text>}</Text>
                <TouchableOpacity 
                    style={styles.dropdownToggle} 
                    onPress={() => setShowSubCategories(!showSubCategories)}
                >
                    <Text style={styles.dropdownToggleText}>
                        {selectedSubCategory 
                            ? (categories.find((c) => String(c._id) === String(selectedSubCategory))?.name || 'Select Sub Category')
                            : 'Select Sub Category'}
                    </Text>
                    {showSubCategories ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
                </TouchableOpacity>

                {showSubCategories && (
                    <View style={styles.multiselectContainer}>
                        {subCategories.map((cat) => {
                        const isSelected = String(selectedSubCategory) === String(cat._id);
                        return (
                            <TouchableOpacity
                            key={cat._id}
                            style={[styles.chip, isSelected && styles.chipSelected, { marginBottom: 4 }]}
                            onPress={() => {
                                setSelectedSubCategory(cat._id);
                                setShowSubCategories(false);
                            }}
                            disabled={saving}
                            >
                            {isSelected && <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                {cat.name}
                            </Text>
                            </TouchableOpacity>
                        );
                        })}
                    </View>
                )}
                </>
            ) : null}

            {/* Also List In Categories (Secondary Categories) */}
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
              <Text style={styles.label}>Also List In Categories</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                Show this product in secondary sections too without altering its main garment specs.
              </Text>

              {/* Secondary Main Category Selector */}
              <TouchableOpacity 
                style={styles.dropdownToggle} 
                onPress={() => setShowSecParentDropdown(!showSecParentDropdown)}
                disabled={saving}
              >
                <Text style={styles.dropdownToggleText}>
                  {selectedSecParent 
                    ? (parentCategories.find((c) => c._id === selectedSecParent)?.name || 'Select Main Category') 
                    : '-- Main Category --'}
                </Text>
                {showSecParentDropdown ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
              </TouchableOpacity>

              {showSecParentDropdown && (
                <View style={styles.multiselectContainer}>
                  {parentCategories.map((cat) => {
                    const isSelected = selectedSecParent === cat._id;
                    return (
                      <TouchableOpacity
                        key={cat._id}
                        style={[styles.chip, isSelected && styles.chipSelected, { marginBottom: 4 }]}
                        onPress={() => {
                          setSelectedSecParent(cat._id);
                          setSelectedSecSub('');
                          setShowSecParentDropdown(false);
                        }}
                        disabled={saving}
                      >
                        {isSelected && <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Secondary Sub Category Selector */}
              {selectedSecParent ? (
                <>
                  <TouchableOpacity 
                    style={[styles.dropdownToggle, { marginTop: 8 }]} 
                    onPress={() => setShowSecSubDropdown(!showSecSubDropdown)}
                    disabled={saving}
                  >
                    <Text style={styles.dropdownToggleText}>
                      {selectedSecSub 
                        ? (secSubCategories.find((c) => c._id === selectedSecSub)?.name || 'Select Sub Category') 
                        : '-- Sub Category (Optional) --'}
                    </Text>
                    {showSecSubDropdown ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
                  </TouchableOpacity>

                  {showSecSubDropdown && (
                    <View style={styles.multiselectContainer}>
                      {secSubCategories.map((cat) => {
                        const isSelected = selectedSecSub === cat._id;
                        return (
                          <TouchableOpacity
                            key={cat._id}
                            style={[styles.chip, isSelected && styles.chipSelected, { marginBottom: 4 }]}
                            onPress={() => {
                              setSelectedSecSub(cat._id);
                              setShowSecSubDropdown(false);
                            }}
                            disabled={saving}
                          >
                            {isSelected && <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                              {cat.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              {/* Add Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (!selectedSecParent && !selectedSecSub) ? '#E2E8F0' : '#1E293B',
                  paddingVertical: 10,
                  borderRadius: 8,
                  marginTop: 10,
                  gap: 6
                }}
                disabled={(!selectedSecParent && !selectedSecSub) || saving}
                onPress={() => {
                  const targetId = selectedSecSub || selectedSecParent;
                  if (!targetId) return;
                  if (targetId === selectedSubCategory || targetId === selectedParentCategory) {
                    Alert.alert('Already Selected', 'This is already selected as the primary category.');
                    return;
                  }
                  if (additionalCategoryIds.includes(targetId)) {
                    Alert.alert('Already Added', 'This category has already been added.');
                    return;
                  }
                  setAdditionalCategoryIds((prev) => [...prev, targetId]);
                  setSelectedSecParent('');
                  setSelectedSecSub('');
                }}
              >
                <Plus size={16} color={(!selectedSecParent && !selectedSecSub) ? '#94A3B8' : '#FFFFFF'} />
                <Text style={{ color: (!selectedSecParent && !selectedSecSub) ? '#94A3B8' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                  Add Secondary Category
                </Text>
              </TouchableOpacity>

              {/* Chips for Selected Additional Categories */}
              {additionalCategoryIds.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {additionalCategoryIds.map((catId) => {
                    const cat = categories.find((c) => String(c._id) === String(catId));
                    const pId = cat?.parentId ? String((cat.parentId as any)?._id || cat.parentId) : '';
                    const parentCat = pId ? categories.find((c) => String(c._id) === pId) : null;
                    const label = cat 
                      ? (parentCat ? `${parentCat.name} > ${cat.name}` : cat.name) 
                      : 'Category';

                    return (
                      <View
                        key={catId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#F1F5F9',
                          borderWidth: 1,
                          borderColor: '#CBD5E1',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          gap: 6
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{label}</Text>
                        <TouchableOpacity
                          onPress={() => setAdditionalCategoryIds((prev) => prev.filter((id) => id !== catId))}
                          disabled={saving}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <X size={14} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={styles.label}>Gender Target *</Text>
            <View style={styles.badgeGroup}>
                {['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'].map((g) => {
                const isSel = genderSelection.includes(g);
                return (
                    <TouchableOpacity
                    key={g}
                    style={[styles.genderBadge, isSel && styles.genderBadgeSelected]}
                    onPress={() => handleGenderToggle(g)}
                    disabled={saving}
                    >
                    {isSel ? <Check size={14} color="#FFFFFF" style={{ marginRight: 4 }} /> : null}
                    <Text style={[styles.genderBadgeText, isSel && styles.genderBadgeTextSelected]}>
                        {g}
                    </Text>
                    </TouchableOpacity>
                );
                })}
            </View>
        </View>

        {/* Product Photos */}
        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Camera size={20} color="#1E293B" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Product Photos (Max 4)</Text>
            </View>
            {selectedImages.length > 0 && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                onPress={handleDownloadAllPhotos}
              >
                <Download size={13} color="#059669" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>Download All ({selectedImages.length})</Text>
              </TouchableOpacity>
            )}
          </View>

          {uploadingImage && (
              <View style={{ marginVertical: 10 }}>
                  <ActivityIndicator color="#1E293B" />
                  <Text style={{ textAlign: 'center', marginTop: 8 }}>Uploading Image...</Text>
              </View>
          )}

          <View style={styles.mediaContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedImages.map((img, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.previewImage} />

                  {/* Cover badge */}
                  {index === 0 ? (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>COVER</Text>
                    </View>
                  ) : (
                    <View style={styles.indexBadge}>
                      <Text style={styles.indexBadgeText}>#{index + 1}</Text>
                    </View>
                  )}

                  {/* Reorder Buttons */}
                  <View style={styles.reorderOverlay}>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.reorderBtn}
                        onPress={() => moveImage(index, 'left')}
                      >
                        <ChevronLeft size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    {index < selectedImages.length - 1 && (
                      <TouchableOpacity
                        style={styles.reorderBtn}
                        onPress={() => moveImage(index, 'right')}
                      >
                        <ChevronRight size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Trash2 size={13} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.downloadImageBtn}
                    onPress={() => handleDownloadSinglePhoto(img.uri, index)}
                  >
                    <Download size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {selectedImages.length < 4 ? (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickPhoto} disabled={uploadingImage}>
                  <Camera size={22} color="#1E293B" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>

        {/* 3. Pricing, Stock & Variant Summary */}
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <DollarSign size={20} color="#1E293B" style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Pricing & Inventory</Text>
            </View>

            <View style={styles.row}>
                <View style={styles.col}>
                    <Text style={styles.label}>MRP (₹) <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(Optional)</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="1999"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={mrp}
                        onChangeText={(val) => {
                            setMrp(val);
                            if (val && price) {
                                const disc = Math.round(((parseFloat(val) - parseFloat(price)) / parseFloat(val)) * 100);
                                setDiscount(Math.max(0, disc).toString());
                            }
                        }}
                        editable={!saving}
                    />
                </View>
                <View style={styles.col}>
                    <Text style={styles.label}>Selling Price (₹) *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="1499"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={price}
                        onChangeText={(val) => {
                            setPrice(val);
                            if (mrp && val) {
                                const disc = Math.round(((parseFloat(mrp) - parseFloat(val)) / parseFloat(mrp)) * 100);
                                setDiscount(Math.max(0, disc).toString());
                            }
                        }}
                        editable={!saving}
                    />
                </View>
                <View style={[styles.col, { flex: 0.8 }]}>
                    <Text style={styles.label}>Disc. %</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: '#F1F5F9', color: '#10B981', fontWeight: '700' }]}
                        value={`${discount}%`}
                        editable={false}
                    />
                </View>
            </View>

            {/* Sizes & Stock */}
            <Text style={styles.label}>Sizes & Inventory *</Text>
            <View style={styles.stockCard}>
                {sizes.map((row, index) => (
                <View key={index} style={styles.stockRow}>
                    <View style={{ flex: 1.2 }}>
                    <Text style={styles.subLabel}>Size *</Text>
                    <TextInput
                        style={styles.smallInput}
                        placeholder="S, M, 32"
                        placeholderTextColor="#94A3B8"
                        value={row.size}
                        onChangeText={(val) => {
                            const updated = [...sizes];
                            updated[index].size = val;
                            setSizes(updated);
                        }}
                    />
                    </View>

                    <View style={{ flex: 2, marginLeft: 8 }}>
                    <Text style={styles.subLabel}>Stock Code (SKU)</Text>
                    <TextInput
                        style={styles.smallInput}
                        placeholder="e.g. S-01"
                        placeholderTextColor="#94A3B8"
                        value={row.merchantSizeCode}
                        onChangeText={(val) => {
                            const updated = [...sizes];
                            updated[index].merchantSizeCode = val;
                            setSizes(updated);
                        }}
                    />
                    </View>

                    <View style={{ flex: 1.2, marginLeft: 8 }}>
                    <Text style={styles.subLabel}>Stock</Text>
                    <TextInput
                        style={styles.smallInput}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={row.stock}
                        onChangeText={(val) => {
                            const updated = [...sizes];
                            updated[index].stock = val;
                            setSizes(updated);
                        }}
                    />
                    </View>

                    <TouchableOpacity
                        style={styles.deleteRowBtn}
                        onPress={() => handleRemoveSizeRow(index)}
                    >
                        <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>
                ))}

                <TouchableOpacity style={styles.addRowBtn} onPress={handleAddSizeRow}>
                    <Plus size={16} color="#64748B" style={{ marginRight: 6 }} />
                    <Text style={styles.addRowText}>Add Size Option</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* 4. Specifications & Advanced Details */}
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Settings size={20} color="#1E293B" style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Specifications & Tags</Text>
            </View>

            {dynamicAttributes.length > 0 ? (
                <View style={styles.specificationsContainer}>
                <Text style={styles.specSectionTitle}>Category Specifications (Optional)</Text>
                {dynamicAttributes.map((attr) => {
                    const getId = (a: any) => String(a.attributeId || a.attribute || (a.attributeId && a.attributeId._id) || (a.attribute && a.attribute._id));
                    const selectedAttr = attributes.find((a) => getId(a) === String(attr._id));
                    const selectedVal = selectedAttr ? selectedAttr.value : '';
                    const isExpanded = expandedAttributeId === attr._id;

                    const getDropdownLabel = () => {
                      if (Array.isArray(selectedVal)) {
                        return selectedVal.length > 0 ? `${selectedVal.length} selected` : `Select ${attr.name} (Optional)`;
                      }
                      if (selectedVal !== undefined && selectedVal !== null && selectedVal !== '') {
                        const found = attr.values?.find((v) => String(v.value) === String(selectedVal) || String(v.label) === String(selectedVal));
                        return found ? found.label : String(selectedVal);
                      }
                      return `Select ${attr.name} (Optional)`;
                    };

                    return (
                    <View key={attr._id} style={styles.attrFormGroup}>
                        <Text style={styles.attrLabel}>
                        {attr.name} <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(Optional)</Text>
                        </Text>

                        {(attr.inputType === 'select' || attr.inputType === 'multiselect') && (
                            <TouchableOpacity 
                                style={styles.dropdownToggleCompact}
                                onPress={() => setExpandedAttributeId(isExpanded ? null : attr._id)}
                            >
                                <Text style={styles.dropdownToggleTextCompact}>
                                    {getDropdownLabel()}
                                </Text>
                                {isExpanded ? <ChevronUp size={18} color="#64748B" /> : <ChevronDown size={18} color="#64748B" />}
                            </TouchableOpacity>
                        )}

                        {isExpanded && (attr.inputType === 'select' || attr.inputType === 'multiselect') && (
                            <View style={[styles.multiselectContainer, { marginTop: 4 }]}>
                                {attr.values?.map((val) => {
                                    const isSelected = Array.isArray(selectedVal) 
                                        ? selectedVal.map(String).includes(String(val.value)) || selectedVal.map(String).includes(String(val.label))
                                        : String(selectedVal) === String(val.value) || String(selectedVal) === String(val.label);

                                    return (
                                        <TouchableOpacity
                                            key={val.value}
                                            style={[styles.smallChip, isSelected && styles.activeSmallChip, { flexDirection: 'row', alignItems: 'center', marginBottom: 6 }]}
                                            onPress={() => handleAttributeChange(attr._id, val.value, attr.inputType === 'multiselect')}
                                        >
                                            {isSelected && <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                                            <Text style={[styles.smallChipText, isSelected && styles.activeSmallChipText]}>
                                                {val.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {(attr.inputType === 'text' || attr.inputType === 'number') && (
                        <TextInput
                            style={styles.input}
                            placeholder={`Enter ${attr.name} (Optional)`}
                            placeholderTextColor="#94A3B8"
                            keyboardType={attr.inputType === 'number' ? 'numeric' : 'default'}
                            value={selectedVal !== undefined && selectedVal !== null ? String(selectedVal) : ''}
                            onChangeText={(text) =>
                            handleAttributeChange(attr._id, attr.inputType === 'number' ? Number(text) || '' : text)
                            }
                        />
                        )}

                        {attr.inputType === 'boolean' && (
                        <View style={styles.toggleRowCompact}>
                            <Text style={styles.toggleRowText}>{attr.name} Enabled?</Text>
                            <Switch
                            value={!!selectedVal}
                            onValueChange={(val) => handleAttributeChange(attr._id, val)}
                            thumbColor={selectedVal ? '#1A1A1A' : '#E2E8F0'}
                            trackColor={{ true: '#1A1A1A50', false: '#CBD5E1' }}
                            />
                        </View>
                        )}
                    </View>
                    );
                })}
                </View>
            ) : null}

            {/* Features Form */}
            <View style={styles.featureHeaderRow}>
                <Text style={styles.label}>Key Features</Text>
                <TouchableOpacity
                style={styles.addFeaturePill}
                onPress={() => setShowFeatureForm(!showFeatureForm)}
                >
                <Plus size={14} color="#1E293B" />
                <Text style={styles.addFeaturePillText}>Add Feature</Text>
                </TouchableOpacity>
            </View>

            {showFeatureForm && (
                <View style={styles.featureFormBox}>
                <Text style={styles.featureFormTitle}>New Feature Pair</Text>
                <TextInput
                    style={styles.inputCompact}
                    placeholder="Property (e.g. Fit)"
                    placeholderTextColor="#94A3B8"
                    value={newKey}
                    onChangeText={setNewKey}
                />
                <TextInput
                    style={styles.inputCompact}
                    placeholder="Value (e.g. Slim Fit)"
                    placeholderTextColor="#94A3B8"
                    value={newVal}
                    onChangeText={setNewVal}
                />
                <View style={styles.featureFormActions}>
                    <TouchableOpacity style={styles.featureFormCancel} onPress={() => setShowFeatureForm(false)}>
                    <Text style={styles.featureFormCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.featureFormAdd} onPress={handleAddFeature}>
                    <Text style={styles.featureFormAddText}>Add</Text>
                    </TouchableOpacity>
                </View>
                </View>
            )}

            {Object.keys(features).length > 0 && (
                <View style={styles.featuresListContainer}>
                {Object.entries(features).map(([key, val]) => (
                    <View key={key} style={styles.featureItemRow}>
                    <Text style={styles.featureItemText}>
                        <Text style={{ fontWeight: '800' }}>{key}:</Text> {val}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveFeature(key)}>
                        <X size={14} color="#EF4444" />
                    </TouchableOpacity>
                    </View>
                ))}
                </View>
            )}

            {/* Collections */}
            {collections.length > 0 ? (
                <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.label}>Nominate for Campaigns & Collections</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 10, lineHeight: 15 }}>
                  Tag festive shirts, traditional wear, or seasonal items to feature in active drops on the customer app.
                </Text>
                <View style={styles.collectionsWrapper}>
                    {collections.map((col: any) => {
                    const isSel = selectedCollections.includes(col._id);
                    const isFestive = col.campaignType === 'festival' || col.campaignType === 'seasonal';
                    return (
                        <TouchableOpacity
                        key={col._id}
                        style={[
                          styles.colChip, 
                          isFestive && { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
                          isSel && styles.activeColChip, 
                          { flexDirection: 'row', alignItems: 'center' }
                        ]}
                        onPress={() => handleToggleCollection(col._id)}
                        >
                        {isSel && <Check size={10} color="#FFFFFF" style={{ marginRight: 4 }} />}
                        <Text style={[
                          styles.colChipText, 
                          isFestive && { color: '#B45309', fontWeight: '700' },
                          isSel && styles.activeColChipText
                        ]}>
                            {col.badgeText ? `${col.badgeText} • ` : isFestive ? '🌸 ' : ''}{col.name}
                        </Text>
                        </TouchableOpacity>
                    );
                    })}
                </View>
                </>
            ) : null}

            {/* Tags */}
            <Text style={styles.label}>Search Tags (Comma Separated)</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g. summer, casual, premium"
                placeholderTextColor="#94A3B8"
                value={tags}
                onChangeText={setTags}
                editable={!saving}
            />
            {tags ? (
                <View style={styles.tagsListContainer}>
                {tags
                    .split(',')
                    .map((t, i) => t.trim() && (
                    <View key={i} style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>{t.trim()}</Text>
                    </View>
                    ))
                }
                </View>
            ) : null}
        </View>

        {/* Save Button */}
        <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSaveChanges}
            disabled={saving}
        >
            {saving ? (
            <ActivityIndicator color="#FFFFFF" />
            ) : (
            <Text style={styles.submitBtnText}>Save Product Details</Text>
            )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warehouseWarningBox: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  warehouseWarningTitle: {
    color: '#991B1B',
    fontWeight: '700',
    marginBottom: 4
  },
  warehouseWarningSub: {
    color: '#7F1D1D',
    fontSize: 13
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  inputCompact: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
    color: '#1A1A1A',
    fontSize: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  dropdownToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  dropdownToggleText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  dropdownToggleCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dropdownToggleTextCompact: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  badgeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  genderBadgeSelected: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  genderBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  genderBadgeTextSelected: {
    color: '#FFFFFF',
  },
  toggleRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  toggleRowText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mediaContainer: {
    marginTop: 8,
  },
  imageWrapper: {
    width: 100,
    height: 125,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deleteProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  deleteProductBtnText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  coverBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  indexBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 2,
  },
  indexBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  reorderOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    gap: 3,
    zIndex: 2,
  },
  reorderBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 20,
  },
  downloadImageBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 6,
    borderRadius: 20,
    zIndex: 2,
  },
  addPhotoBtn: {
    width: 100,
    height: 125,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
  stockCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 16
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  smallInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  deleteRowBtn: {
    padding: 10,
    marginLeft: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  featureHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  addFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  addFeaturePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  featureFormBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  featureFormTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  featureFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  featureFormCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featureFormCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  featureFormAdd: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  featureFormAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featuresListContainer: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  featureItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  featureItemText: {
    fontSize: 13,
    color: '#334155',
  },
  specificationsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  specSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  attrFormGroup: {
    marginBottom: 14,
  },
  attrLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  smallChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  activeSmallChip: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeSmallChipText: {
    color: '#FFFFFF',
  },
  multiselectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  checkboxChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeCheckboxChip: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  checkboxChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeCheckboxChipText: {
    color: '#FFFFFF',
  },
  collectionsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  colChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeColChip: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  colChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeColChipText: {
    color: '#FFFFFF',
  },
  tagsListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  }
});
