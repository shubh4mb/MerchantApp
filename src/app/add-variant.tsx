import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Minus, Trash2, Camera, Image as ImageIcon, Package, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLOR_FAMILIES, POPULAR_COLORS } from '@/utils/colors';
import ColorFamilySelector from '@/components/ColorFamilySelector';
import { getMerchantEnteredSku } from '@/utils/skuUtils';

interface SizeStock {
  size: string;
  sizeCode: string;
  stock: string;
}

export default function AddVariantScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();

  const [loadingParent, setLoadingParent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedColorFamily, setSelectedColorFamily] = useState<string>('All');

  // Pre-filled Parent Product Details
  const [productName, setProductName] = useState('');
  const [styleName, setStyleName] = useState('');
  const [description, setDescription] = useState('');
  const [brandName, setBrandName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [isTriable, setIsTriable] = useState(true);
  const [genderSelection, setGenderSelection] = useState<string[]>([]);

  // Variant specific states
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#000000');
  
  // Pricing states
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('0');

  // Stock states
  const [sizes, setSizes] = useState<SizeStock[]>([{ size: 'M', sizeCode: '', stock: '10' }]);

  // Media state
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Pre-fill parent product data
  useEffect(() => {
    if (!productId) return;
    const fetchParent = async () => {
      try {
        setLoadingParent(true);
        const res = await api.get(`/merchant/getBaseProductById/${productId}`);
        const prod = res.data?.product || res.data || {};

        setProductName(prod.name || '');
        setStyleName(prod.styleName || '');
        setDescription(prod.description || '');
        setBrandName(typeof prod.brand === 'object' ? prod.brand?.name : (prod.brand || prod.soldBy || ''));
        setCategoryName(typeof prod.category === 'object' ? prod.category?.name : (prod.category || ''));
        setSubCategoryName(typeof prod.subCategory === 'object' ? prod.subCategory?.name : (prod.subCategory || ''));
        setIsTriable(prod.isTriable !== false);
        setGenderSelection(prod.gender || []);

        if (prod.mrp) setMrp(String(prod.mrp));
        if (prod.price) setPrice(String(prod.price));
        if (prod.discount) setDiscount(String(prod.discount));

        if (prod.sizes && prod.sizes.length > 0) {
          setSizes(
            prod.sizes.map((s: any) => {
              const raw = s.merchantSizeCode || s.sizeCode || '';
              const clean = getMerchantEnteredSku(raw, s.merchantSizeCode, [s]);
              return {
                size: s.size || 'M',
                sizeCode: clean !== '—' ? clean : raw,
                stock: String(s.stock ?? 10),
              };
            })
          );
        }
      } catch (err) {
        console.error('Failed to load parent product details:', err);
      } finally {
        setLoadingParent(false);
      }
    };
    fetchParent();
  }, [productId]);

  const handleGenderToggle = (gender: string) => {
    if (genderSelection.includes(gender)) {
      setGenderSelection(genderSelection.filter((g) => g !== gender));
    } else {
      setGenderSelection([...genderSelection, gender]);
    }
  };

  const handleAddSizeRow = () => {
    setSizes([...sizes, { size: '', sizeCode: '', stock: '0' }]);
  };

  const handleRemoveSizeRow = (index: number) => {
    setSizes(sizes.filter((_, idx) => idx !== index));
  };

  const handlePickPhoto = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraPermission.granted || !galleryPermission.granted) {
      Alert.alert('Permission Denied', 'Camera and Photo Library access is required.');
      return;
    }

    Alert.alert(
      'Variant Image',
      'Choose image source:',
      [
        {
          text: 'Camera (Snap Photo)',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImages([...selectedImages, result.assets[0].uri]);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImages([...selectedImages, result.assets[0].uri]);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, idx) => idx !== index));
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedImages.length) return;
    const updated = [...selectedImages];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setSelectedImages(updated);
  };

  const handleSubmit = async () => {
    if (!colorName.trim() || !mrp.trim() || !price.trim()) {
      setError('Please fill in Color Name, MRP, and Price.');
      return;
    }
    if (!productName.trim()) {
      setError('Product Name is required.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', productName.trim());
      formData.append('styleName', styleName.trim());
      formData.append('description', description.trim());
      formData.append('gender', JSON.stringify(genderSelection));
      formData.append('isTriable', String(isTriable));

      formData.append('color', JSON.stringify({ name: colorName.trim(), hex: colorHex }));
      
      const formattedSizes = sizes
        .filter((s) => s.size.trim() !== '')
        .map((s) => ({
          size: s.size.trim(),
          merchantSizeCode: s.sizeCode.trim() || undefined,
          stock: parseInt(s.stock) || 0
        }));
      formData.append('sizes', JSON.stringify(formattedSizes));

      formData.append('mrp', mrp);
      formData.append('price', price);
      formData.append('discount', discount);

      // Append images
      selectedImages.forEach((uri, idx) => {
        const filename = uri.split('/').pop() || `variant_image_${idx}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('images', {
          uri,
          name: filename,
          type,
        } as any);
      });

      await api.post(`/merchant/addVariant/${productId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Color variant added successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create variant.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingParent) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  const GENDER_OPTIONS = ['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Section 1: Pre-filled Product Details */}
        <View style={styles.parentCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Package size={18} color="#1E293B" style={{ marginRight: 6 }} />
            <Text style={styles.sectionHeaderTitle}>Product Details (Pre-filled)</Text>
          </View>

          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Product Name"
            placeholderTextColor="#94A3B8"
            value={productName}
            onChangeText={setProductName}
            editable={!submitting}
          />

          <Text style={styles.label}>Category & Sub-Category</Text>
          <View style={styles.readOnlyBadge}>
            <Text style={styles.readOnlyBadgeText} numberOfLines={1}>
              {categoryName || 'Category'}{subCategoryName ? ` • ${subCategoryName}` : ''}
            </Text>
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Product description..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            editable={!submitting}
          />

          {/* Gender focus */}
          <Text style={styles.label}>Gender Focus Tags</Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((g) => {
              const active = genderSelection.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, active && styles.genderChipActive]}
                  onPress={() => handleGenderToggle(g)}
                  disabled={submitting}
                >
                  <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </View>

        <View style={styles.form}>
          <Text style={styles.sectionHeaderTitle}>New Color Variant Details</Text>

          <Text style={styles.label}>Color Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Cherry Red, Slate Gray"
            placeholderTextColor="#94A3B8"
            value={colorName}
            onChangeText={setColorName}
            editable={!submitting}
          />

          <Text style={styles.label}>Filter by Color Family</Text>
          <ColorFamilySelector 
            selectedFamily={selectedColorFamily} 
            onSelectFamily={setSelectedColorFamily} 
            showAllOption={true} 
          />

          <Text style={styles.label}>Select Preset Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {(selectedColorFamily.toUpperCase() === 'ALL'
              ? POPULAR_COLORS
              : (COLOR_FAMILIES.find((f) => f.family.toUpperCase() === selectedColorFamily.toUpperCase())?.colors || POPULAR_COLORS)
            ).map((c) => (
              <TouchableOpacity
                key={`${c.name}_${c.hex}`}
                style={[
                  styles.colorChip,
                  colorHex === c.hex && styles.colorChipSelected,
                ]}
                onPress={() => {
                  setColorName(c.name);
                  setColorHex(c.hex);
                }}
              >
                <View style={[styles.colorCircle, { backgroundColor: c.hex, borderWidth: c.hex.toLowerCase() === '#ffffff' ? 1 : 0, borderColor: '#CBD5E1' }]} />
                <Text style={styles.colorChipText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Pricing Row */}
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>MRP *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1999"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={mrp}
                onChangeText={(val) => {
                  setMrp(val);
                  if (val && price) {
                    const discountPercent = Math.round(((parseFloat(val) - parseFloat(price)) / parseFloat(val)) * 100);
                    setDiscount(Math.max(0, discountPercent).toString());
                  }
                }}
                editable={!submitting}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Selling Price *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1499"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={price}
                onChangeText={(val) => {
                  setPrice(val);
                  if (mrp && val) {
                    const discountPercent = Math.round(((parseFloat(mrp) - parseFloat(val)) / parseFloat(mrp)) * 100);
                    setDiscount(Math.max(0, discountPercent).toString());
                  }
                }}
                editable={!submitting}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Discount %</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 25"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={discount}
                onChangeText={setDiscount}
                editable={false}
              />
            </View>
          </View>

          {/* Sizes & Stock */}
          <Text style={styles.label}>Sizes & Stock Inventory</Text>
          <View style={styles.stockCard}>
            {sizes.map((row, index) => (
              <View key={index} style={styles.stockRow}>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.subLabel}>Size *</Text>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="e.g. M, 34"
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
                  <Text style={styles.subLabel}>Size Code (SKU)</Text>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="e.g. M-01"
                    placeholderTextColor="#94A3B8"
                    value={row.sizeCode}
                    onChangeText={(val) => {
                      const updated = [...sizes];
                      updated[index].sizeCode = val;
                      setSizes(updated);
                    }}
                  />
                </View>
                <View style={{ flex: 2.4, marginLeft: 8 }}>
                  <Text style={styles.subLabel}>Stock</Text>
                  <View style={styles.stockCounterRow}>
                    <TouchableOpacity
                      style={styles.stockCounterBtn}
                      onPress={() => {
                        const current = parseInt(row.stock, 10) || 0;
                        const updated = [...sizes];
                        updated[index].stock = Math.max(0, current - 1).toString();
                        setSizes(updated);
                      }}
                    >
                      <Minus size={12} color="#0F172A" />
                    </TouchableOpacity>

                    <TextInput
                      style={[styles.smallInput, styles.stockNumberInput]}
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

                    <TouchableOpacity
                      style={styles.stockCounterBtn}
                      onPress={() => {
                        const current = parseInt(row.stock, 10) || 0;
                        const updated = [...sizes];
                        updated[index].stock = (current + 1).toString();
                        setSizes(updated);
                      }}
                    >
                      <Plus size={12} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
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
              <Text style={styles.addRowText}>Add Size Row</Text>
            </TouchableOpacity>
          </View>

          {/* Image Upload list */}
          <Text style={styles.label}>Variant Photos</Text>
          <View style={styles.mediaContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedImages.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.previewImage} />

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
                </View>
              ))}

              <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickPhoto}>
                <Camera size={20} color="#1A1A1A" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Add Color Variant</Text>
            )}
          </TouchableOpacity>
        </View>
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
    padding: 24,
    paddingBottom: 48,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    color: '#1A1A1A',
    fontSize: 15,
  },
  smallInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    color: '#1A1A1A',
    fontSize: 14,
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  deleteRowBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  mediaContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 64,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    top: -4,
    right: -4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  submitBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  parentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  readOnlyBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 50,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  readOnlyBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  genderChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  genderChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  genderChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  genderChipTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  stockCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockCounterBtn: {
    width: 32,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockNumberInput: {
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 12,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
    gap: 6,
  },
  colorChipSelected: {
    borderColor: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
  },
  colorCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  familyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  familyChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  familyChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  familyChipTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
