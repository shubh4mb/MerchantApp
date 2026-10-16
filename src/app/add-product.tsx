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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api, { createProductFull, analyzeProductWithAi } from '../utils/api';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Check, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Plus, Trash2, Camera, Tag, DollarSign, Package, Layers, X, Search, Sparkles, Image as ImageIcon } from 'lucide-react-native';

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

interface SizeStockRow {
  size: string;
  sizeCode: string;
  stock: string;
}

import { COLOR_FAMILIES, POPULAR_COLORS } from '@/utils/colors';
import ColorFamilySelector from '@/components/ColorFamilySelector';

export default function AddProductScreen() {
  const { merchant } = useAuth();
  const router = useRouter();
  const [selectedColorFamily, setSelectedColorFamily] = useState<string>('All');

  // Loaders
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Categories & Attributes Lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [dynamicAttributes, setDynamicAttributes] = useState<DynamicAttribute[]>([]);

  // Base Form Values
  const [name, setName] = useState('');
  const [styleName, setStyleName] = useState('');
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>([]);
  const [selectedSecParent, setSelectedSecParent] = useState<string>('');
  const [selectedSecSub, setSelectedSecSub] = useState<string>('');
  const [showSecParentDropdown, setShowSecParentDropdown] = useState(false);
  const [showSecSubDropdown, setShowSecSubDropdown] = useState(false);
  const [description, setDescription] = useState('');
  const [isTriable, setIsTriable] = useState(true);
  const [genderSelection, setGenderSelection] = useState<string[]>(['MEN', 'WOMEN']);
  const [tagsInput, setTagsInput] = useState('');

  // Attributes
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});

  // Variant / Style Details
  const [productSku, setProductSku] = useState('');
  const [colorName, setColorName] = useState('Black');
  const [colorHex, setColorHex] = useState('#000000');
  
  // Pricing
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('0');

  // Sizes & Stock
  const [sizes, setSizes] = useState<SizeStockRow[]>([
    { size: 'S', sizeCode: '', stock: '10' },
    { size: 'M', sizeCode: '', stock: '10' },
    { size: 'L', sizeCode: '', stock: '10' },
  ]);

  // Variant Photos
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Gemini AI Auto-Fill States
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiAutoFilled, setAiAutoFilled] = useState(false);
  const [aiSuccessInfo, setAiSuccessInfo] = useState<{
    category?: string;
    subCategory?: string;
    color?: string;
  } | null>(null);

  // Fetch Categories on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const catRes = await api.get('/merchant/getCategories');
        setCategories(catRes.data?.categories || catRes.data || []);
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Dynamic Attributes when Sub Category changes
  useEffect(() => {
    const fetchAttributes = async () => {
      if (!selectedSubCategory) {
        setDynamicAttributes([]);
        setAttributeValues({});
        return;
      }
      try {
        const res = await api.get('/merchant/attributes', {
          params: { categoryId: selectedSubCategory },
        });
        setDynamicAttributes(res.data?.attributes || []);
        setAttributeValues({});
      } catch (err) {
        console.error('Failed to fetch dynamic attributes:', err);
      }
    };
    fetchAttributes();
  }, [selectedSubCategory]);

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

  const runAiAnalysisOnUri = async (uri: string, initialBase64?: string) => {
    try {
      setAnalyzingAi(true);
      setError('');

      const filename = uri.split('/').pop() || `ai_prod_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      let ext = match ? match[1].toLowerCase() : 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      const cleanFilename = filename.includes('.') ? filename : `${filename}.${ext}`;

      let metadata;

      // Primary strategy: FormData (fast, native direct streaming without huge JS heap strings)
      try {
        const formData = new FormData();
        formData.append('image', {
          uri,
          name: cleanFilename,
          type: mimeType,
        } as any);

        metadata = await analyzeProductWithAi(formData);
      } catch (formErr: any) {
        console.warn('FormData AI analysis failed, trying base64 fallback:', formErr?.message || formErr);

        // Fallback strategy: Base64 JSON
        let base64 = initialBase64;
        if (!base64) {
          try {
            base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: 'base64',
            });
          } catch (readErr) {
            console.warn('Could not read base64 via FileSystem:', readErr);
          }
        }

        if (base64) {
          metadata = await analyzeProductWithAi({ image: base64, mimeType });
        } else {
          throw formErr;
        }
      }

      if (!metadata) {
        throw new Error('AI analysis did not return product details.');
      }

      // Auto-fill product title, style name, description
      if (metadata.name) setName(metadata.name);
      if (metadata.styleName) setStyleName(metadata.styleName);
      if (metadata.description) setDescription(metadata.description);

      // Ensure categories list is available for matching
      let activeCategories = categories;
      if (!activeCategories || activeCategories.length === 0) {
        try {
          const catRes = await api.get('/merchant/getCategories');
          activeCategories = catRes.data?.categories || catRes.data || [];
          setCategories(activeCategories);
        } catch {
          // ignore
        }
      }

      // Match parent & sub category
      const matchParent = activeCategories.find(
        (c) =>
          c.level === 0 &&
          (String(c._id) === String(metadata.categoryId) ||
            c.name?.trim().toLowerCase() === metadata.category?.trim().toLowerCase())
      );
      if (matchParent) {
        setSelectedParentCategory(matchParent._id);
      }

      const matchSub = activeCategories.find(
        (c) =>
          c.level === 1 &&
          (String(c._id) === String(metadata.subCategoryId) ||
            c.name?.trim().toLowerCase() === metadata.subCategory?.trim().toLowerCase())
      );
      if (matchSub) {
        setSelectedSubCategory(matchSub._id);
        if (!matchParent && matchSub.parentId) {
          setSelectedParentCategory(String((matchSub.parentId as any)?._id || matchSub.parentId));
        }
      }

      // Gender Focus
      if (Array.isArray(metadata.gender) && metadata.gender.length > 0) {
        setGenderSelection(metadata.gender);
      }

      // Color Auto-detection
      if (metadata.color?.name) {
        setColorName(metadata.color.name);
        if (metadata.color.hex) setColorHex(metadata.color.hex);
      }

      // Tags
      if (Array.isArray(metadata.tags) && metadata.tags.length > 0) {
        setTagsInput(metadata.tags.join(', '));
      }

      // isTriable
      if (typeof metadata.isTriable === 'boolean') {
        setIsTriable(metadata.isTriable);
      }

      // Add image to selectedImages as primary cover if not present
      if (!selectedImages.includes(uri)) {
        if (selectedImages.length >= 4) {
          setSelectedImages([uri, ...selectedImages.slice(0, 3)]);
        } else {
          setSelectedImages([uri, ...selectedImages]);
        }
      }

      setAiAutoFilled(true);
      setAiSuccessInfo({
        category: metadata.category,
        subCategory: metadata.subCategory,
        color: metadata.color?.name,
      });

      Alert.alert(
        '✨ AI Auto-Fill Complete',
        `Recognized: ${metadata.category || 'Product'} > ${metadata.subCategory || ''} in ${metadata.color?.name || 'Color'}.\n\nPlease set Selling Price and Stock to complete!`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      console.error('AI Analysis request error details:', {
        url: err.config?.url,
        baseURL: err.config?.baseURL,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      Alert.alert('AI Analysis Error', err.response?.data?.message || err.message || 'Failed to analyze image with AI.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  const handlePickAndAnalyzeAi = async (source?: 'camera' | 'gallery') => {
    if (analyzingAi) return;

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraPermission.granted || !galleryPermission.granted) {
      Alert.alert('Permission Denied', 'Camera and Photo Library access is required.');
      return;
    }

    const launchPicker = async (type: 'camera' | 'gallery') => {
      try {
        let result;
        if (type === 'camera') {
          result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.5,
            base64: true,
          });
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.5,
            base64: true,
          });
        }

        if (!result.canceled && result.assets?.[0]?.uri) {
          const asset = result.assets[0];
          await runAiAnalysisOnUri(asset.uri, asset.base64 || undefined);
        }
      } catch (err: any) {
        console.error('Image pick error:', err);
        Alert.alert('Error', err.message || 'Failed to select image.');
      }
    };

    if (source) {
      await launchPicker(source);
    } else {
      Alert.alert(
        '✨ Gemini AI Smart Auto-Fill',
        'Choose product photo source for Gemini AI to analyze:',
        [
          { text: '📷 Camera', onPress: () => launchPicker('camera') },
          { text: '🖼️ Gallery', onPress: () => launchPicker('gallery') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handlePickPhoto = async () => {
    if (selectedImages.length >= 4) {
      Alert.alert('Limit Reached', 'Maximum 4 images allowed per product variation.');
      return;
    }

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraPermission.granted || !galleryPermission.granted) {
      Alert.alert('Permission Denied', 'Camera and Photo Library access is required.');
      return;
    }

    Alert.alert(
      'Product Image',
      'Choose image source:',
      [
        {
          text: '📷 Camera',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.7,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImages([...selectedImages, result.assets[0].uri]);
            }
          },
        },
        {
          text: '🖼️ Gallery',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.7,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImages([...selectedImages, result.assets[0].uri]);
            }
          },
        },
        {
          text: '✨ Auto-Fill via Camera (AI)',
          onPress: () => handlePickAndAnalyzeAi('camera'),
        },
        {
          text: '✨ Auto-Fill via Gallery (AI)',
          onPress: () => handlePickAndAnalyzeAi('gallery'),
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

  const handleSubmitFullProduct = async () => {
    if (!price || parseFloat(price) <= 0) return setError('Please enter a valid Selling Price.');
    if (!selectedParentCategory) return setError('Please select a Main Category.');
    if (!selectedSubCategory) return setError('Please select a Sub Category. Subcategory is mandatory.');

    const formattedSizes = sizes
      .filter((s) => s.size.trim() !== '')
      .map((s) => ({
        size: s.size.trim(),
        sizeCode: s.sizeCode.trim() || `${(productSku.trim() || 'SKU')}-${s.size.trim()}`,
        stock: parseInt(s.stock) || 0,
      }));

    if (formattedSizes.length === 0) return setError('Please add at least one valid size with stock.');
    if (selectedImages.length === 0) return setError('Please upload at least one product photo.');

    const parsedPrice = parseFloat(price) || 0;
    let parsedMrp = parseFloat(mrp) || 0;
    if (parsedMrp <= 0 || parsedMrp < parsedPrice) {
      parsedMrp = parsedPrice;
    }
    const parsedDiscount = parsedMrp > 0 ? Math.round(((parsedMrp - parsedPrice) / parsedMrp) * 100) : 0;

    const finalName = name.trim() || styleName.trim() || 'New Product';
    const finalSku = productSku.trim() || ('SKU-' + Math.random().toString(36).substring(2, 7).toUpperCase());
    const finalColorName = colorName.trim() || 'Standard';
    const finalColorHex = colorHex.trim() || '#111827';

    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', finalName);
      formData.append('styleName', styleName.trim() || finalName);
      if (selectedParentCategory) formData.append('categoryId', selectedParentCategory);
      if (selectedSubCategory) formData.append('subCategoryId', selectedSubCategory);
      if (additionalCategoryIds.length > 0) formData.append('additionalCategoryIds', JSON.stringify(additionalCategoryIds));
      formData.append('description', description.trim());
      formData.append('isTriable', String(isTriable));
      formData.append('gender', JSON.stringify(genderSelection));

      // Parse tags
      const tagsArray = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      formData.append('tags', JSON.stringify(tagsArray));

      // Attributes array (clean empty values; if none, send empty array)
      const attributesPayload = Object.entries(attributeValues)
        .filter(([_, val]) => val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0))
        .map(([attrId, val]) => ({
          attributeId: attrId,
          value: val,
        }));
      formData.append('attributes', JSON.stringify(attributesPayload));

      const merchantId = merchant?._id || merchant?.id || '';
      formData.append('merchantId', merchantId);

      // Append image files & tracking keys in exact reordered sequence
      const imageFields: string[] = [];
      const orderedImages: any[] = [];
      selectedImages.forEach((uri, idx) => {
        const fieldName = `var_0_img_${idx}`;
        imageFields.push(fieldName);
        orderedImages.push({ type: 'file', fieldname: fieldName });

        const filename = uri.split('/').pop() || `prod_image_${idx}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append(fieldName, {
          uri,
          name: filename,
          type,
        } as any);
      });

      // Variants payload
      const variantsPayload = [
        {
          color: { name: finalColorName, hex: finalColorHex },
          mrp: parsedMrp,
          price: parsedPrice,
          discount: Math.max(0, parsedDiscount),
          sizes: formattedSizes,
          productSku: finalSku,
          imageFields,
          orderedImages,
        },
      ];

      formData.append('variants', JSON.stringify(variantsPayload));

      await createProductFull(formData);

      Alert.alert('Product Created', 'Product and initial variation created successfully!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/products') },
      ]);
    } catch (err: any) {
      console.error('Create product full error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  };

  const parentCategories = categories.filter((c) => c.level === 0 && (c.isActive !== false));
  const subCategories = categories.filter(
    (c) => c.level === 1 && String((c.parentId as any)?._id || c.parentId) === String(selectedParentCategory) && (c.isActive !== false)
  );
  const secSubCategories = categories.filter(
    (c) => c.level === 1 && String((c.parentId as any)?._id || c.parentId) === String(selectedSecParent) && (c.isActive !== false)
  );

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

        {/* ✨ GEMINI AI AUTO-FILL HERO CARD */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <View style={styles.aiIconBadge}>
              <Sparkles size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.aiCardTitle}>Gemini AI Auto-Fill</Text>
                <View style={styles.aiFastBadge}>
                  <Text style={styles.aiFastBadgeText}>AI ⚡</Text>
                </View>
              </View>
              <Text style={styles.aiCardSubtitle}>
                Choose Camera or Gallery photo to instantly detect title, category, gender, color, description & tags!
              </Text>
            </View>
          </View>

          {analyzingAi ? (
            <View style={styles.aiAnalyzingBox}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.aiAnalyzingText}>Analyzing garment with Gemini AI...</Text>
                <Text style={styles.aiAnalyzingSubtext}>Recognizing style, category & color specs</Text>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.aiPrimaryBtn, { flex: 1 }]}
                  onPress={() => handlePickAndAnalyzeAi('camera')}
                  activeOpacity={0.8}
                >
                  <Camera size={18} color="#FFFFFF" />
                  <Text style={styles.aiPrimaryBtnText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.aiSecondaryBtn, { flex: 1 }]}
                  onPress={() => handlePickAndAnalyzeAi('gallery')}
                  activeOpacity={0.8}
                >
                  <ImageIcon size={18} color="#7C3AED" />
                  <Text style={styles.aiSecondaryBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              {aiAutoFilled && aiSuccessInfo && (
                <View style={[styles.aiSuccessBanner, { marginTop: 10 }]}>
                  <Check size={16} color="#059669" />
                  <Text style={styles.aiSuccessBannerText}>
                    ✨ Auto-filled: {aiSuccessInfo.category} &gt; {aiSuccessInfo.subCategory} ({aiSuccessInfo.color})
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* 1. Base Product Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Package size={20} color="#1E293B" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>1. Basic Product Information</Text>
            {aiAutoFilled && (
              <View style={styles.aiFieldBadge}>
                <Sparkles size={10} color="#7C3AED" />
                <Text style={styles.aiFieldBadgeText}>AI Filled</Text>
              </View>
            )}
          </View>

          <Text style={styles.label}>Product Name / Title <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(Optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Classic Oversized Cotton Tee"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            editable={!submitting}
          />

          {/* Main Category */}
          <Text style={styles.label}>Main Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {parentCategories.map((cat) => {
              const isSelected = selectedParentCategory === cat._id;
              return (
                <TouchableOpacity
                  key={cat._id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => {
                    setSelectedParentCategory(cat._id);
                    setSelectedSubCategory('');
                  }}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sub Category */}
          {selectedParentCategory ? (
            <>
              <Text style={styles.label}>Sub Category * {!selectedSubCategory && <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>(Required)</Text>}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {subCategories.map((cat) => {
                  const isSelected = String(selectedSubCategory) === String(cat._id);
                  return (
                    <TouchableOpacity
                      key={cat._id}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setSelectedSubCategory(cat._id)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {/* Also List In Categories (Secondary Categories) */}
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <Text style={styles.label}>Also List In Categories</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
              Show this product in secondary sections too without altering its main garment specs.
            </Text>

            {/* Secondary Main Category Chips */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Secondary Main Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {parentCategories.map((cat) => {
                const isSelected = selectedSecParent === cat._id;
                return (
                  <TouchableOpacity
                    key={cat._id}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedSecParent('');
                        setSelectedSecSub('');
                      } else {
                        setSelectedSecParent(cat._id);
                        setSelectedSecSub('');
                      }
                    }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Secondary Sub Category Chips */}
            {selectedSecParent ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 8, marginBottom: 4 }}>Secondary Sub Category:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {secSubCategories.map((cat) => {
                    const isSelected = selectedSecSub === cat._id;
                    return (
                      <TouchableOpacity
                        key={cat._id}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => setSelectedSecSub(isSelected ? '' : cat._id)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {/* Add Secondary Category Button */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: (!selectedSecParent && !selectedSecSub) ? '#E2E8F0' : '#1E293B',
                paddingVertical: 9,
                borderRadius: 8,
                marginTop: 10,
                gap: 6
              }}
              disabled={(!selectedSecParent && !selectedSecSub) || submitting}
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
              <Plus size={15} color={(!selectedSecParent && !selectedSecSub) ? '#94A3B8' : '#FFFFFF'} />
              <Text style={{ color: (!selectedSecParent && !selectedSecSub) ? '#94A3B8' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                Add Secondary Category
              </Text>
            </TouchableOpacity>

            {/* Chips for Selected Additional Categories */}
            {additionalCategoryIds.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
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
                        paddingVertical: 5,
                        gap: 6
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{label}</Text>
                      <TouchableOpacity
                        onPress={() => setAdditionalCategoryIds((prev) => prev.filter((id) => id !== catId))}
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

          {/* Gender */}
          <Text style={styles.label}>Gender Target *</Text>
          <View style={styles.badgeGroup}>
            {['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'].map((g) => {
              const isSel = genderSelection.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBadge, isSel && styles.genderBadgeSelected]}
                  onPress={() => handleGenderToggle(g)}
                >
                  {isSel ? <Check size={14} color="#FFFFFF" style={{ marginRight: 4 }} /> : null}
                  <Text style={[styles.genderBadgeText, isSel && styles.genderBadgeTextSelected]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Detailed description of fabric, fit, and care instructions..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            editable={!submitting}
          />

          {/* Tags */}
          <Text style={styles.label}>Tags (Comma Separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. summer, cotton, casual, printed"
            placeholderTextColor="#94A3B8"
            value={tagsInput}
            onChangeText={setTagsInput}
            editable={!submitting}
          />

        </View>

        {/* Dynamic Category Specifications */}
        {dynamicAttributes.length > 0 ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Layers size={20} color="#1E293B" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Category Specifications (Optional)</Text>
            </View>
            {dynamicAttributes.map((attr) => (
              <View key={attr._id} style={{ marginBottom: 12 }}>
                <Text style={styles.label}>{attr.name} <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(Optional)</Text></Text>
                {attr.values && attr.values.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {attr.values.map((v) => {
                      const isSel = attributeValues[attr._id] === v.value;
                      return (
                        <TouchableOpacity
                          key={v.value}
                          style={[styles.chip, isSel && styles.chipSelected]}
                          onPress={() => setAttributeValues((prev) => {
                            const updated = { ...prev };
                            if (updated[attr._id] === v.value) {
                              delete updated[attr._id];
                            } else {
                              updated[attr._id] = v.value;
                            }
                            return updated;
                          })}
                        >
                          <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>{v.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter ${attr.name} (Optional)`}
                    placeholderTextColor="#94A3B8"
                    value={attributeValues[attr._id] || ''}
                    onChangeText={(val) => setAttributeValues((prev) => {
                      const updated = { ...prev };
                      if (val === '') {
                        delete updated[attr._id];
                      } else {
                        updated[attr._id] = val;
                      }
                      return updated;
                    })}
                  />
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* 2. Color & SKU Variation */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Tag size={20} color="#1E293B" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>2. Style Variation & Color</Text>
          </View>

          <Text style={styles.label}>Product SKU Prefix <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(Optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. TSH-BLK-01"
            placeholderTextColor="#94A3B8"
            value={productSku}
            onChangeText={setProductSku}
            editable={!submitting}
          />

          <Text style={styles.label}>Color Name <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(Optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Jet Black, Navy Blue"
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
        </View>

        {/* 3. Pricing */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <DollarSign size={20} color="#1E293B" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>3. Pricing & Discount</Text>
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
                editable={!submitting}
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
                editable={!submitting}
              />
            </View>

            <View style={styles.col}>
              <Text style={styles.label}>Discount %</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#F1F5F9' }]}
                value={discount}
                editable={false}
              />
            </View>
          </View>
        </View>

        {/* 4. Sizes & Stock Inventory */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Package size={20} color="#1E293B" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>4. Sizes & Stock Inventory</Text>
          </View>

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
                  <Text style={styles.subLabel}>Size Code (SKU)</Text>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="e.g. S-01"
                    placeholderTextColor="#94A3B8"
                    value={row.sizeCode}
                    onChangeText={(val) => {
                      const updated = [...sizes];
                      updated[index].sizeCode = val;
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

        {/* 5. Variant Images */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Camera size={20} color="#1E293B" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>5. Product Photos (Max 4) *</Text>
          </View>

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

                  {/* AI Analyze this specific image button */}
                  <TouchableOpacity
                    style={styles.aiImageAnalyzeBtn}
                    onPress={() => runAiAnalysisOnUri(uri)}
                    disabled={analyzingAi}
                  >
                    <Sparkles size={10} color="#FFFFFF" />
                    <Text style={styles.aiImageAnalyzeBtnText}>AI</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Trash2 size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {selectedImages.length < 4 ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.addPhotoBtn}
                    onPress={async () => {
                      const perm = await ImagePicker.requestCameraPermissionsAsync();
                      if (!perm.granted) return Alert.alert('Permission Denied', 'Camera access is required.');
                      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 5], quality: 0.7 });
                      if (!result.canceled && result.assets?.[0]?.uri) {
                        setSelectedImages([...selectedImages, result.assets[0].uri]);
                      }
                    }}
                  >
                    <Camera size={20} color="#1E293B" />
                    <Text style={styles.addPhotoText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.addPhotoBtn}
                    onPress={async () => {
                      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!perm.granted) return Alert.alert('Permission Denied', 'Gallery access is required.');
                      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 5], quality: 0.7 });
                      if (!result.canceled && result.assets?.[0]?.uri) {
                        setSelectedImages([...selectedImages, result.assets[0].uri]);
                      }
                    }}
                  >
                    <ImageIcon size={20} color="#1E293B" />
                    <Text style={styles.addPhotoText}>Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addPhotoBtn, { borderColor: '#A78BFA', backgroundColor: '#F5F3FF' }]}
                    onPress={() => handlePickAndAnalyzeAi()}
                    disabled={analyzingAi}
                  >
                    {analyzingAi ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <>
                        <Sparkles size={20} color="#7C3AED" />
                        <Text style={[styles.addPhotoText, { color: '#7C3AED' }]}>AI Auto-Fill</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>

        {/* Global Submit */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmitFullProduct}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Create Product</Text>
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
    marginTop: 8,
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
  smallInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
  },
  chipRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chip: {
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
    color: '#475569',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  switchSub: {
    fontSize: 12,
    color: '#64748B',
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  colorChipSelected: {
    borderColor: '#1E293B',
    backgroundColor: '#E2E8F0',
  },
  colorCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  colorChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  stockCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteRowBtn: {
    marginLeft: 8,
    padding: 8,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  mediaContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  imageWrapper: {
    position: 'relative',
    width: 80,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
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
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBtn: {
    width: 80,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
  aiCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B21B6',
  },
  aiFastBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiFastBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  aiCardSubtitle: {
    fontSize: 12,
    color: '#6D28D9',
    marginTop: 2,
    lineHeight: 16,
  },
  aiAnalyzingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  aiAnalyzingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9',
  },
  aiAnalyzingSubtext: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 1,
  },
  aiPrimaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  aiPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  aiSecondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aiSecondaryBtnText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '700',
  },
  aiSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  aiSuccessBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
  aiFieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    gap: 3,
  },
  aiFieldBadgeText: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '700',
  },
  aiImageAnalyzeBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(109, 40, 217, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  aiImageAnalyzeBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
