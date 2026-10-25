import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  LogOut,
  User,
  Mail,
  Shield,
  Bell,
  HelpCircle,
  Store,
  Clock,
  MapPin,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Calendar,
  Locate,
  Check,
  ChevronRight,
  Tag,
  Camera,
  FileText,
} from 'lucide-react-native';

const COMMON_CATEGORIES = ['Clothing', 'Footwear', 'Accessories', 'Bags', 'Activewear'];

export default function ProfileScreen() {
  const { merchant, logout, updateMerchantState } = useAuth();
  const { isConnected } = useSocket();
  const router = useRouter();

  // Loaders
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const handlePickAndUploadBranding = async (type: 'logo' | 'backgroundImage') => {
    if (!merchant?.id) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is required to update store images.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.85,
      });

      if (res.canceled || !res.assets?.[0]?.uri) return;

      const asset = res.assets[0];
      const uri = asset.uri;
      const filename = uri.split('/').pop() || `${type}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';

      if (type === 'logo') setUploadingLogo(true);
      else setUploadingBg(true);

      const formData = new FormData();
      formData.append(type, {
        uri,
        name: filename,
        type: fileType,
      } as any);

      const response = await api.put(`merchant/${merchant.id}/branding`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data?.merchant) {
        setFullMerchant(response.data.merchant);
        if (type === 'logo' && response.data.logo) {
          updateMerchantState({ logo: response.data.logo });
        }
      }

      Alert.alert(
        'Success',
        type === 'logo' ? 'Store logo updated successfully!' : 'Store cover banner updated successfully!'
      );
    } catch (err: any) {
      console.error('Error updating branding:', err);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update image.');
    } finally {
      setUploadingLogo(false);
      setUploadingBg(false);
    }
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState<'shop' | 'hours' | 'location' | 'bank'>('shop');

  // Full merchant details from server
  const [fullMerchant, setFullMerchant] = useState<any>(null);

  // Forms State
  const [shopForm, setShopForm] = useState({
    shopName: '',
    shopDescription: '',
    ownerName: '',
    enableCourierDelivery: false,
    shipsWithinHours: 24,
    acceptsReturns: false,
    genderCategory: [] as string[],
    category: [] as string[],
    storeMobileNumber: '',
    pickupContactNumber: '',
  });

  const [addressForm, setAddressForm] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    landmark: '',
    latitude: 0,
    longitude: 0,
  });

  const [operatingHours, setOperatingHours] = useState({
    open: '09:00',
    close: '21:00',
    daysOpen: [] as string[],
  });

  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
  });

  const [kycForm, setKycForm] = useState({
    panNumber: '',
    gstNumber: '',
    panImageUri: '',
  });

  // Fetch complete profile on mount
  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await api.get('merchant/getMerchant');
      const data = res.data?.merchant || res.data;
      if (data) {
        setFullMerchant(data);
        if (typeof data.isOnline === 'boolean') {
          updateMerchantState({ isOnline: data.isOnline });
        }
        setShopForm({
          shopName: data.shopName || '',
          shopDescription: data.shopDescription || '',
          ownerName: data.ownerName || '',
          enableCourierDelivery: !!data.enableCourierDelivery,
          shipsWithinHours: data.shipsWithinHours || 24,
          acceptsReturns: !!data.acceptsReturns,
          genderCategory: data.genderCategory || [],
          category: data.category || [],
          storeMobileNumber: data.storeMobileNumber || '',
          pickupContactNumber: data.pickupContactNumber || '',
        });
        setAddressForm({
          street: data.address?.street || '',
          city: data.address?.city || '',
          state: data.address?.state || '',
          postalCode: data.address?.postalCode || '',
          landmark: data.address?.landmark || '',
          latitude: data.address?.latitude || data.address?.location?.coordinates?.[1] || 0,
          longitude: data.address?.longitude || data.address?.location?.coordinates?.[0] || 0,
        });
        setOperatingHours({
          open: data.operatingHours?.open || '09:00',
          close: data.operatingHours?.close || '21:00',
          daysOpen: data.operatingHours?.daysOpen || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        });
        setBankForm({
          accountHolderName: data.bankDetails?.accountHolderName || '',
          accountNumber: data.bankDetails?.accountNumber || '',
          ifscCode: data.bankDetails?.ifscCode || '',
          bankName: data.bankDetails?.bankName || '',
          upiId: data.bankDetails?.upiId || '',
        });
        setKycForm({
          panNumber: data.kyc?.pan?.number || '',
          gstNumber: data.kyc?.gst?.number || '',
          panImageUri: '',
        });
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      Alert.alert('Error', 'Failed to load profile details.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleToggleOnline = async (newVal: boolean) => {
    if (!merchant?.id) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`merchant/${merchant.id}/toggle-online`, {
        isOnline: newVal,
      });
      const updatedOnline = typeof res.data?.isOnline === 'boolean' ? res.data.isOnline : newVal;
      updateMerchantState({ isOnline: updatedOnline });
      Alert.alert('Status Updated', `Your store is now ${updatedOnline ? 'ONLINE' : 'OFFLINE'}.`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update online status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleGetLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      setAddressForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      Alert.alert('Location Pinned', `GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)} successfully captured!`);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to fetch device location: ' + err.message);
    }
  };

  // Section Save functions
  const saveShopInfo = async () => {
    if (!merchant?.id) return;
    setSavingSection('shop');
    try {
      const payload = new FormData();
      payload.append('shopName', shopForm.shopName);
      payload.append('shopDescription', shopForm.shopDescription);
      payload.append('ownerName', shopForm.ownerName);
      payload.append('storeMobileNumber', shopForm.storeMobileNumber);
      payload.append('pickupContactNumber', shopForm.pickupContactNumber);
      payload.append('category', shopForm.category.join(','));
      payload.append('genderCategory', shopForm.genderCategory.join(','));
      payload.append('enableCourierDelivery', String(shopForm.enableCourierDelivery));
      payload.append('shipsWithinHours', String(shopForm.shipsWithinHours));
      payload.append('acceptsReturns', String(shopForm.acceptsReturns));
      
      // Coordinates and Address are required together
      payload.append('address', JSON.stringify(addressForm));
      payload.append('latitude', String(addressForm.latitude));
      payload.append('longitude', String(addressForm.longitude));

      const res = await api.put(`merchant/${merchant.id}/shop-details`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateMerchantState({
        shopName: shopForm.shopName,
        ownerName: shopForm.ownerName,
      });

      Alert.alert('Success', 'Store information updated successfully!');
      if (res.data?.merchant) {
        setFullMerchant(res.data.merchant);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update store information.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveLocation = async () => {
    if (!merchant?.id) return;
    setSavingSection('location');
    try {
      const payload = new FormData();
      payload.append('shopName', shopForm.shopName);
      payload.append('address', JSON.stringify(addressForm));
      payload.append('latitude', String(addressForm.latitude));
      payload.append('longitude', String(addressForm.longitude));

      const res = await api.put(`merchant/${merchant.id}/shop-details`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Address and location pinned successfully!');
      if (res.data?.merchant) {
        setFullMerchant(res.data.merchant);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update location details.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveHours = async () => {
    if (!merchant?.id) return;
    setSavingSection('hours');
    try {
      const res = await api.put(`merchant/${merchant.id}/operating-hours`, operatingHours);
      Alert.alert('Success', 'Operating timings updated successfully!');
      if (res.data?.merchant) {
        setFullMerchant(res.data.merchant);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update timings.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveBank = async () => {
    if (!merchant?.id) return;
    setSavingSection('bank');
    try {
      const res = await api.put(`merchant/${merchant.id}/bank-details`, bankForm);
      Alert.alert('Success', 'Settlement details updated successfully!');
      if (res.data?.merchant) {
        setFullMerchant(res.data.merchant);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update bank details.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveKyc = async () => {
    if (!merchant?.id) return;
    setSavingSection('kyc');
    try {
      const payload = new FormData();
      if (kycForm.panNumber) payload.append('panNumber', kycForm.panNumber.toUpperCase());
      if (kycForm.gstNumber) payload.append('gstNumber', kycForm.gstNumber.toUpperCase());
      
      if (kycForm.panImageUri) {
        payload.append('panImage', { uri: kycForm.panImageUri, name: 'pan.jpg', type: 'image/jpeg' } as any);
      }

      const res = await api.put(`merchant/${merchant.id}/kyc`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Success', 'KYC details updated successfully!');
      if (res.data?.merchant) {
        setFullMerchant(res.data.merchant);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update KYC details.');
    } finally {
      setSavingSection(null);
    }
  };

  const pickImage = async (field: 'panImageUri') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery access is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setKycForm({ ...kycForm, [field]: res.assets[0].uri });
    }
  };

  const handleToggleGender = (val: string) => {
    const isSelected = shopForm.genderCategory.includes(val);
    const updated = isSelected
      ? shopForm.genderCategory.filter((x) => x !== val)
      : [...shopForm.genderCategory, val];
    setShopForm({ ...shopForm, genderCategory: updated });
  };

  const handleToggleCategory = (val: string) => {
    const isSelected = shopForm.category.includes(val);
    const updated = isSelected
      ? shopForm.category.filter((x) => x !== val)
      : [...shopForm.category, val];
    setShopForm({ ...shopForm, category: updated });
  };

  const handleToggleDay = (day: string) => {
    const isSelected = operatingHours.daysOpen.includes(day);
    const updated = isSelected
      ? operatingHours.daysOpen.filter((d) => d !== day)
      : [...operatingHours.daysOpen, day];
    setOperatingHours({ ...operatingHours, daysOpen: updated });
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your merchant account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loadingProfile || !merchant) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>Syncing Store Details...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Merchant Profile Header */}
        <View style={styles.profileHeaderCard}>
          {/* Banner Cover with Edit Option */}
          <View style={styles.bannerContainer}>
            {fullMerchant?.backgroundImage?.url ? (
              <Image source={{ uri: fullMerchant.backgroundImage.url }} style={styles.bannerImage} />
            ) : (
              <View style={[styles.bannerImage, { backgroundColor: '#1E293B' }]} />
            )}
            <TouchableOpacity
              onPress={() => handlePickAndUploadBranding('backgroundImage')}
              disabled={uploadingBg}
              style={styles.bannerEditButton}
              activeOpacity={0.8}
            >
              {uploadingBg ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Camera size={13} color="#FFFFFF" />
                  <Text style={styles.bannerEditText}>Edit Cover</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Profile Logo with Edit Option */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarContainer}>
              {fullMerchant?.logo?.url ? (
                <Image source={{ uri: fullMerchant.logo.url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {merchant.shopName.substring(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handlePickAndUploadBranding('logo')}
              disabled={uploadingLogo}
              style={styles.avatarEditButton}
              activeOpacity={0.8}
            >
              {uploadingLogo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={12} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.shopName}>{merchant.shopName}</Text>
          <Text style={styles.ownerName}>{shopForm.ownerName || merchant.ownerName || 'Store Manager'}</Text>

          <View style={[styles.activeBadge, { backgroundColor: merchant.isActive ? '#10B98115' : '#EF444415' }]}>
            <Text style={[styles.activeBadgeText, { color: merchant.isActive ? '#10B981' : '#EF4444' }]}>
              {merchant.isActive ? 'KYC VERIFIED' : 'PENDING ACTIVATION'}
            </Text>
          </View>
        </View>

        {/* Online Status Toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Store Availability</Text>
            <Text style={styles.toggleSubtitle}>
              {merchant.isOnline
                ? 'Active online. Customers can place orders.'
                : 'Offline. Store closed for ordering.'}
            </Text>
            <View style={styles.socketIndicator}>
              <View style={[styles.dot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />
              <Text style={styles.socketText}>
                {isConnected ? 'Alert Sockets: Connected' : 'Alert Sockets: Offline'}
              </Text>
            </View>
          </View>

          {updatingStatus ? (
            <ActivityIndicator color="#1A1A1A" style={styles.toggleLoader} />
          ) : (
            <Switch
              value={merchant.isOnline}
              onValueChange={handleToggleOnline}
              thumbColor={merchant.isOnline ? '#10B981' : '#E2E8F0'}
              trackColor={{ true: '#10B98150', false: '#CBD5E1' }}
            />
          )}
        </View>

        {/* Tabs / Sub-Sections Selector */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab('shop')}
            style={[styles.tabButton, activeTab === 'shop' && styles.tabButtonActive]}
          >
            <Store size={16} color={activeTab === 'shop' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabButtonText, activeTab === 'shop' && styles.tabButtonTextActive]}>Store</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('hours')}
            style={[styles.tabButton, activeTab === 'hours' && styles.tabButtonActive]}
          >
            <Clock size={16} color={activeTab === 'hours' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabButtonText, activeTab === 'hours' && styles.tabButtonTextActive]}>Hours</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('location')}
            style={[styles.tabButton, activeTab === 'location' && styles.tabButtonActive]}
          >
            <MapPin size={16} color={activeTab === 'location' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabButtonText, activeTab === 'location' && styles.tabButtonTextActive]}>Location</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('bank')}
            style={[styles.tabButton, activeTab === 'bank' && styles.tabButtonActive]}
          >
            <CreditCard size={16} color={activeTab === 'bank' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabButtonText, activeTab === 'bank' && styles.tabButtonTextActive]}>Bank</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content Panels */}
        {activeTab === 'shop' && (
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>Verified Store Details</Text>

            <View style={styles.readOnlyInfoGroup}>
              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Shop Name</Text>
                <Text style={styles.readOnlyValue}>{shopForm.shopName || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Owner Full Name</Text>
                <Text style={styles.readOnlyValue}>{shopForm.ownerName || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Store Mobile Number</Text>
                <Text style={styles.readOnlyValue}>{shopForm.storeMobileNumber || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Pickup Contact Number</Text>
                <Text style={styles.readOnlyValue}>{shopForm.pickupContactNumber || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Shop Description</Text>
                <Text style={styles.readOnlyValue}>{shopForm.shopDescription || 'No description provided'}</Text>
              </View>


              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Gender Segments Served</Text>
                <View style={styles.readOnlyBadgeRow}>
                  {shopForm.genderCategory.length > 0 ? (
                    shopForm.genderCategory.map((g) => (
                      <View key={g} style={styles.readOnlyBadge}>
                        <Text style={styles.readOnlyBadgeText}>{g}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.readOnlyValue}>None</Text>
                  )}
                </View>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Category Specialties</Text>
                <View style={styles.readOnlyBadgeRow}>
                  {shopForm.category.length > 0 ? (
                    shopForm.category.map((cat) => (
                      <View key={cat} style={styles.readOnlyBadge}>
                        <Text style={styles.readOnlyBadgeText}>{cat}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.readOnlyValue}>None</Text>
                  )}
                </View>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Courier Delivery Status</Text>
                <Text style={styles.readOnlyValue}>
                  {shopForm.enableCourierDelivery ? 'Enabled' : 'Disabled'}
                </Text>
              </View>

              {shopForm.enableCourierDelivery && (
                <>
                  <View style={styles.readOnlyItem}>
                    <Text style={styles.readOnlyLabel}>Estimated Shipping Time</Text>
                    <Text style={styles.readOnlyValue}>Ships within {shopForm.shipsWithinHours} hours</Text>
                  </View>
                  <View style={styles.readOnlyItem}>
                    <Text style={styles.readOnlyLabel}>Accepts Returns</Text>
                    <Text style={styles.readOnlyValue}>{shopForm.acceptsReturns ? 'Yes' : 'No'}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {activeTab === 'hours' && (
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>Store Operating Hours</Text>
            
            <View style={styles.readOnlyInfoGroup}>
              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Opening Time</Text>
                <Text style={styles.readOnlyValue}>{operatingHours.open || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Closing Time</Text>
                <Text style={styles.readOnlyValue}>{operatingHours.close || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Active Days of the Week</Text>
                <View style={styles.readOnlyBadgeRow}>
                  {operatingHours.daysOpen.length > 0 ? (
                    operatingHours.daysOpen.map((day) => (
                      <View key={day} style={styles.readOnlyBadge}>
                        <Text style={styles.readOnlyBadgeText}>{day}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.readOnlyValue}>None</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'location' && (
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>Physical Store Location</Text>

            <View style={styles.readOnlyInfoGroup}>
              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Street Address</Text>
                <Text style={styles.readOnlyValue}>{addressForm.street || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>City</Text>
                <Text style={styles.readOnlyValue}>{addressForm.city || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>State</Text>
                <Text style={styles.readOnlyValue}>{addressForm.state || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Pincode / Postal Code</Text>
                <Text style={styles.readOnlyValue}>{addressForm.postalCode || 'Not Set'}</Text>
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Landmark</Text>
                <Text style={styles.readOnlyValue}>{addressForm.landmark || 'None'}</Text>
              </View>

            </View>
          </View>
        )}

        {activeTab === 'bank' && (
          <View style={styles.formCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.formCardTitle}>Settlement Bank Details</Text>
              <TouchableOpacity
                onPress={saveBank}
                disabled={savingSection === 'bank'}
                style={{ backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
              >
                {savingSection === 'bank' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.readOnlyInfoGroup}>
              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Account Holder Name</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.accountHolderName}
                  onChangeText={(val) => setBankForm({ ...bankForm, accountHolderName: val })}
                  placeholder="Account Holder Name"
                />
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Account Number</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.accountNumber}
                  onChangeText={(val) => setBankForm({ ...bankForm, accountNumber: val })}
                  placeholder="Account Number"
                />
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Bank Name</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.bankName}
                  onChangeText={(val) => setBankForm({ ...bankForm, bankName: val })}
                  placeholder="Bank Name"
                />
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>IFSC Code</Text>
                <TextInput
                  style={[styles.input, { textTransform: 'uppercase' }]}
                  value={bankForm.ifscCode}
                  onChangeText={(val) => setBankForm({ ...bankForm, ifscCode: val })}
                  placeholder="IFSC Code"
                />
              </View>

              <View style={styles.readOnlyItem}>
                <Text style={styles.readOnlyLabel}>Settlement UPI ID</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.upiId}
                  onChangeText={(val) => setBankForm({ ...bankForm, upiId: val })}
                  placeholder="UPI ID (Optional)"
                />
              </View>
            </View>

            {/* KYC Logs */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
              <Text style={styles.subHeader}>KYC Verification Logs</Text>
              <TouchableOpacity
                onPress={saveKyc}
                disabled={savingSection === 'kyc'}
                style={{ backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
              >
                {savingSection === 'kyc' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Save KYC</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.kycCard}>
              <View style={styles.kycItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kycTitle}>PAN Card Identity</Text>
                  {fullMerchant?.kyc?.pan?.verified ? (
                    <Text style={styles.kycNumber}>{fullMerchant?.kyc?.pan?.number}</Text>
                  ) : (
                    <TextInput
                      style={[styles.input, { marginTop: 8, height: 40, textTransform: 'uppercase' }]}
                      value={kycForm.panNumber}
                      onChangeText={(val) => setKycForm({ ...kycForm, panNumber: val })}
                      placeholder="PAN Number"
                    />
                  )}
                  {!fullMerchant?.kyc?.pan?.verified && (
                    <TouchableOpacity onPress={() => pickImage('panImageUri')} style={{ marginTop: 8 }}>
                      <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>
                        {kycForm.panImageUri ? '✓ Image Selected (Tap to change)' : '+ Upload PAN Image'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {fullMerchant?.kyc?.pan?.verified ? (
                  <View style={[styles.kycBadge, styles.kycVerified]}>
                    <CheckCircle size={12} color="#10B981" style={{ marginRight: 4 }} />
                    <Text style={[styles.kycBadgeText, { color: '#10B981' }]}>VERIFIED</Text>
                  </View>
                ) : (
                  <View style={[styles.kycBadge, styles.kycPending]}>
                    <AlertCircle size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                    <Text style={[styles.kycBadgeText, { color: '#F59E0B' }]}>PENDING</Text>
                  </View>
                )}
              </View>

              <View style={styles.kycItemDivider} />

              <View style={styles.kycItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kycTitle}>GST Tax Identity (Optional)</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 8, height: 40, textTransform: 'uppercase' }]}
                    value={kycForm.gstNumber}
                    onChangeText={(val) => setKycForm({ ...kycForm, gstNumber: val })}
                    placeholder="GST Number (Optional)"
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Store Management */}
        <Text style={styles.sectionTitle}>Store Management</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/offers')}>
            <View style={styles.settingLabelContainer}>
              <Tag size={18} color="#64748B" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Coupons & Offers</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/zip-covers')}>
            <View style={styles.settingLabelContainer}>
              <Store size={18} color="#64748B" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Order Zip Covers</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/bank-and-documents')}>
            <View style={styles.settingLabelContainer}>
              <Shield size={18} color="#64748B" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Bank & KYC Documents</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/policies' as any)}>
            <View style={styles.settingLabelContainer}>
              <FileText size={18} color="#64748B" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Terms & Platform Policies</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Preferences / Info Settings (preserved and styled clean) */}
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <Mail size={18} color="#64748B" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Email Address</Text>
            </View>
            <Text style={styles.settingValue}>{merchant.email}</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <Store size={18} color="#64748B" style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Merchant ID</Text>
            </View>
            <Text style={styles.settingValue} numberOfLines={1} ellipsizeMode="middle">
              {merchant.id}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Sign Out Account</Text>
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
  readOnlyInfoGroup: {
    gap: 14,
    marginBottom: 8,
  },
  readOnlyItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readOnlyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  readOnlyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  readOnlyBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  readOnlyBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readOnlyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  readOnlyDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  formCardSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingBottom: 24,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  bannerContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerEditButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  bannerEditText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarWrapper: {
    marginTop: -38,
    position: 'relative',
    marginBottom: 10,
  },
  avatarContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  shopName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  ownerName: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  activeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 24,
  },
  toggleInfo: {
    flex: 1,
    paddingRight: 16,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  socketIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  socketText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  toggleLoader: {
    paddingHorizontal: 10,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#1A1A1A',
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
    marginBottom: 24,
  },
  formCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  businessTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  chipButtonActive: {
    borderColor: '#1A1A1A',
    backgroundColor: '#1A1A1A',
  },
  chipButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipButtonTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleRowTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  toggleRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  toggleRowDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  subFormContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  toggleRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  toggleRowTitleCompact: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  saveBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  timeCol: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    marginTop: 4,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dayButtonActive: {
    borderColor: '#1A1A1A',
    backgroundColor: '#1A1A1A',
  },
  dayButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dayButtonTextActive: {
    color: '#FFFFFF',
  },
  coordinatesCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  coordLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  coordValue: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  gpsButton: {
    backgroundColor: '#475569',
    borderRadius: 8,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  gpsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  subHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 10,
  },
  kycCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  kycItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  kycItemDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  kycTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  kycNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 2,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycVerified: {
    backgroundColor: '#10B98115',
  },
  kycPending: {
    backgroundColor: '#F59E0B15',
  },
  kycBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  settingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 10,
  },
  settingLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    maxWidth: '50%',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    height: 52,
    marginTop: 12,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
