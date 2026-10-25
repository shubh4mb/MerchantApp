import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import api from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Upload,
  Locate,
  Maximize2,
  X,
  Search,
  ExternalLink,
} from 'lucide-react-native';
import MapView, { Marker, Region } from 'react-native-maps';

const STEPS = [
  { id: 1, title: 'Shop Details' },
  { id: 2, title: 'Bank Info' },
  { id: 3, title: 'KYC Documents' },
  { id: 4, title: 'Operating Hours' },
];

const BUSINESS_TYPES = ['Individual', 'Sole Proprietor', 'Partnership', 'Company'];
const GENDER_CATEGORIES = ['Men', 'Women', 'Kids'];
const PROOF_TYPES = [
  { id: 'shop_license', label: 'Shop & Establishment License' },
  { id: 'gst_cert', label: 'GST Certificate' },
  { id: 'udyam', label: 'Udyam Registration (MSME)' },
  { id: 'rent_agreement', label: 'Rental Agreement' },
];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function OnboardingScreen() {
  const router = useRouter();
  const { merchant, logout, updateMerchantState } = useAuth();

  const isPending = merchant?.status === 'pending_verification';
  const isRejected = merchant?.status === 'rejected';

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Shop details
  const [shopName, setShopName] = useState(merchant?.shopName || '');
  const [shopDescription, setShopDescription] = useState('');
  const [genderCategory, setGenderCategory] = useState<string[]>([]);
  const [ownerName, setOwnerName] = useState(merchant?.ownerName || '');
  const [storeMobileNumber, setStoreMobileNumber] = useState('');
  const [pickupContactNumber, setPickupContactNumber] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPhoneNumber, setManagerPhoneNumber] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [enableCourier, setEnableCourier] = useState(false);
  const [shipsWithinHours, setShipsWithinHours] = useState('24');
  const [acceptsReturns, setAcceptsReturns] = useState(true);

  // Map Navigation & Drag States
  const mapRef = useRef<MapView>(null);
  const fullMapRef = useRef<MapView>(null);
  const [parentScrollEnabled, setParentScrollEnabled] = useState(true);
  const [isMapPanning, setIsMapPanning] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showFullMapModal, setShowFullMapModal] = useState(false);
  const pinLiftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pinLiftAnim, {
      toValue: isMapPanning ? -14 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 90,
    }).start();
  }, [isMapPanning]);

  // Step 2: Bank details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [upiId, setUpiId] = useState('');

  // Step 3: KYC Details
  const [panNumber, setPanNumber] = useState('');
  const [panImageUri, setPanImageUri] = useState<string | null>(null);
  const [gstNumber, setGstNumber] = useState('');
  const [businessProofType, setBusinessProofType] = useState('');
  const [businessProofImageUri, setBusinessProofImageUri] = useState<string | null>(null);
  const [bankProofImageUri, setBankProofImageUri] = useState<string | null>(null);

  // Step 4: Operating setup
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('21:00');
  const [daysOpen, setDaysOpen] = useState<string[]>(DAYS_OF_WEEK);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const loadMerchantData = async () => {
      if (!merchant?.id) return;
      try {
        setLoading(true);
        const res = await api.get('merchant/getMerchant');
        const data = res.data?.merchant;
        if (data) {
          updateMerchantState({
            status: data.status,
            rejectionReason: data.rejectionReason,
            isActive: data.isActive
          });
          
          if (data.isActive || data.status === 'active') {
            router.replace('/(tabs)/orders');
            return;
          }
          if (data.status === 'pending_payment') {
            router.replace('/payment');
            return;
          }
          if (data.status === 'pending_verification' || data.status === 'payment_pending_verification') {
            router.replace('/pending-verification');
            return;
          }
          
          setShopName(data.shopName || '');
          setShopDescription(data.shopDescription || '');
          setOwnerName(data.ownerName || '');
          setStoreMobileNumber(data.storeMobileNumber || '');
          setPickupContactNumber(data.pickupContactNumber || '');
          
          if (data.address) {
            setStreet(data.address.street || '');
            setCity(data.address.city || '');
            setState(data.address.state || '');
            setPostalCode(data.address.postalCode || '');
            setLandmark(data.address.landmark || '');
            setAddressNote(data.address.note || '');
            setLatitude(data.address.latitude ? data.address.latitude.toString() : '');
            setLongitude(data.address.longitude ? data.address.longitude.toString() : '');
          }
          if (data.logo?.url) setLogoUri(data.logo.url);
          if (data.backgroundImage?.url) setBannerUri(data.backgroundImage.url);
          
          setEnableCourier(!!data.enableCourierDelivery);
          setShipsWithinHours(data.shipsWithinHours ? data.shipsWithinHours.toString() : '24');
          setAcceptsReturns(data.acceptsReturns !== false);
          setGenderCategory(data.genderCategory || []);
          
          if (data.bankDetails) {
            setBankName(data.bankDetails.bankName || '');
            setAccountHolderName(data.bankDetails.accountHolderName || '');
            setAccountNumber(data.bankDetails.accountNumber || '');
            setConfirmAccountNumber(data.bankDetails.accountNumber || '');
            setIfscCode(data.bankDetails.ifscCode || '');
            setUpiId(data.bankDetails.upiId || '');
          }
          if (data.kyc) {
            setPanNumber(data.kyc.pan?.number || '');
            if (data.kyc.pan?.image?.url) setPanImageUri(data.kyc.pan.image.url);
            setGstNumber(data.kyc.gst?.number || '');
            setBusinessProofType(data.kyc.businessProof?.proofType || '');
          }
        }
      } catch (err) {
        console.warn('Failed to load merchant onboarding data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMerchantData();
  }, [merchant?.id]);

  // Reverse geocoding helper (Native first, fallback to OSM Nominatim)
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      if (Platform.OS !== 'web') {
        const addresses = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          const streetParts = [
            addr.streetNumber,
            addr.street || addr.name,
            addr.district,
            addr.subregion && addr.subregion !== addr.city ? addr.subregion : null,
          ].filter(Boolean);
          if (streetParts.length > 0) setStreet(streetParts.join(', '));
          if (addr.city) setCity(addr.city);
          if (addr.region) setState(addr.region);
          if (addr.postalCode) setPostalCode(addr.postalCode);
          return;
        }
      }
    } catch (_) {}

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': 'FlashFitsMerchantApp/1.0', 'Accept-Language': 'en' } }
      );
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const streetVal = [addr.house_number, addr.road || addr.suburb || addr.neighbourhood || addr.residential]
          .filter(Boolean)
          .join(' ');
        const cityVal = addr.city || addr.town || addr.village || addr.county || '';
        const stateVal = addr.state || '';
        const postalCodeVal = addr.postcode || '';

        if (streetVal) setStreet(streetVal);
        if (cityVal) setCity(cityVal);
        if (stateVal) setState(stateVal);
        if (postalCodeVal) setPostalCode(postalCodeVal);
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
  };

  // Location auto-detection using native device GPS
  const handleDetectLocation = async () => {
    setIsLocating(true);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              setLatitude(lat.toFixed(6));
              setLongitude(lng.toFixed(6));
              await reverseGeocode(lat, lng);
              setIsLocating(false);
            },
            () => {
              Alert.alert('GPS Notice', 'Could not detect browser location.');
              setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
          );
        } else {
          setIsLocating(false);
        }
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please grant location permissions to detect your store GPS coordinates.'
        );
        setIsLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));

      const region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      };

      mapRef.current?.animateToRegion(region, 600);
      fullMapRef.current?.animateToRegion(region, 600);

      await reverseGeocode(lat, lng);
    } catch (err: any) {
      console.warn('GPS detection failed:', err);
      Alert.alert('GPS Notice', 'Could not detect GPS location. You can search your address or pan the map directly.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSearchAddress = async () => {
    const q = searchQuery.trim();
    if (!q) {
      Alert.alert('Search Place', 'Please enter a shop location or area to search.');
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=1`,
        { headers: { 'User-Agent': 'FlashFitsMerchantApp/1.0', 'Accept-Language': 'en' } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const match = data[0];
        const lat = parseFloat(match.lat);
        const lng = parseFloat(match.lon);
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));

        const region = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        mapRef.current?.animateToRegion(region, 600);
        fullMapRef.current?.animateToRegion(region, 600);

        await reverseGeocode(lat, lng);
      } else {
        Alert.alert('Not Found', 'Location not found. Try searching by landmark, market, or PIN code.');
      }
    } catch (err) {
      console.warn('Search geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegionChangeComplete = async (region: Region) => {
    setIsMapPanning(false);
    setParentScrollEnabled(true);
    if (region && region.latitude && region.longitude) {
      setLatitude(region.latitude.toFixed(6));
      setLongitude(region.longitude.toFixed(6));
      await reverseGeocode(region.latitude, region.longitude);
    }
  };

  const handleMapPress = (e: any) => {
    const coord = e?.nativeEvent?.coordinate;
    if (coord?.latitude && coord?.longitude) {
      const lat = coord.latitude;
      const lng = coord.longitude;
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
      const region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      };
      mapRef.current?.animateToRegion(region, 400);
      fullMapRef.current?.animateToRegion(region, 400);
      reverseGeocode(lat, lng);
    }
  };

  const handleConfirmModalLocation = () => {
    setShowFullMapModal(false);
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        }, 400);
      }, 300);
    }
  };

  // Image Selector helper
  const handlePickImage = async (onSelected: (uri: string) => void) => {
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraPerm.granted || !libraryPerm.granted) {
      Alert.alert('Permission Denied', 'Camera and Gallery access is required.');
      return;
    }

    Alert.alert('Select Photo Source', 'Choose source:', [
      {
        text: 'Camera',
        onPress: async () => {
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            onSelected(res.assets[0].uri);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            onSelected(res.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSkip = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const validateStep = () => {
    setError('');
    if (currentStep === 1) {
      if (!shopName.trim()) return 'Shop Name is required.';
      if (!ownerName.trim()) return 'Owner Name is required.';
      if (!storeMobileNumber.trim()) return 'Store Mobile Number is required.';
      if (!pickupContactNumber.trim()) return 'Pickup Contact Number is required.';
      if (!street.trim() || !city.trim() || !postalCode.trim()) return 'Address details are incomplete.';
      if (!latitude.trim() || !longitude.trim()) return 'Latitude & Longitude coordinates are required for delivery radial mapping.';
      if (!logoUri) return 'Shop Logo image is required.';
    }
    if (currentStep === 2) {
      // Allow skipping bank details, but validate if partially filled
      if (bankName.trim() || accountHolderName.trim() || accountNumber.trim() || ifscCode.trim()) {
        if (!bankName.trim()) return 'Bank Name is required.';
        if (!accountHolderName.trim()) return 'Account Holder Name is required.';
        if (!accountNumber.trim()) return 'Account Number is required.';
        if (!confirmAccountNumber.trim()) return 'Confirm Account Number is required.';
        if (accountNumber !== confirmAccountNumber) return 'Account numbers do not match.';
        if (!ifscCode.trim()) return 'IFSC Code is required.';
      }
    }
    if (currentStep === 3) {
      // Allow skipping KYC details, but validate if partially filled
      if (panNumber.trim() || panImageUri) {
        if (!panNumber.trim()) return 'PAN Number is required.';
        if (!panImageUri) return 'PAN Card document image is required.';
      }
    }
    if (currentStep === 4) {
      if (daysOpen.length === 0) return 'Select at least one operating day.';
      if (!termsAccepted) return 'Please agree to the FlashFits Merchant Partner Terms & Policies before submitting.';
    }
    return '';
  };

  const handleNext = async () => {
    if (isPending) {
      if (currentStep < 4) setCurrentStep(currentStep + 1);
      return;
    }
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // Submit all onboarding details (Step 4 -> Activation)
    setLoading(true);
    setError('');

    try {
      const merchantId = merchant?.id;
      if (!merchantId) throw new Error('Merchant profile context is missing.');

      // 1. Submit Shop Details
      const shopData = new FormData();
      shopData.append('shopName', shopName.trim());
      shopData.append('shopDescription', shopDescription.trim());
      shopData.append('genderCategory', genderCategory.join(','));
      shopData.append('ownerName', ownerName.trim());
      shopData.append('storeMobileNumber', storeMobileNumber.trim());
      shopData.append('pickupContactNumber', pickupContactNumber.trim());
      shopData.append('managerName', managerName.trim());
      shopData.append('managerPhoneNumber', managerPhoneNumber.trim());
      shopData.append('managerEmail', managerEmail.trim());
      shopData.append('latitude', latitude.trim());
      shopData.append('longitude', longitude.trim());
      shopData.append('enableCourierDelivery', String(enableCourier));
      shopData.append('shipsWithinHours', shipsWithinHours);
      shopData.append('acceptsReturns', String(acceptsReturns));

      const addressObj = { street, city, state, postalCode, landmark, note: addressNote };
      shopData.append('address', JSON.stringify(addressObj));

      if (logoUri) {
        const logoName = logoUri.split('/').pop() || 'logo.jpg';
        shopData.append('logo', { uri: logoUri, name: logoName, type: 'image/jpeg' } as any);
      }
      if (bannerUri) {
        const bannerName = bannerUri.split('/').pop() || 'banner.jpg';
        shopData.append('backgroundImage', { uri: bannerUri, name: bannerName, type: 'image/jpeg' } as any);
      }

      await api.put(`merchant/${merchantId}/shop-details`, shopData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 2. Submit Bank Details (if provided)
      if (accountNumber.trim()) {
        await api.put(`merchant/${merchantId}/bank-details`, {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          accountHolderName: accountHolderName.trim(),
          upiId: upiId.trim(),
        });
      }

      // 3. Submit KYC Details (if provided)
      if (panNumber.trim() && panImageUri) {
        const kycData = new FormData();
        kycData.append('panNumber', panNumber.trim().toUpperCase());
        kycData.append('gstNumber', gstNumber.trim().toUpperCase());
        kycData.append('businessProofType', businessProofType);

        if (panImageUri) {
          const panName = panImageUri.split('/').pop() || 'pan.jpg';
          kycData.append('panImage', { uri: panImageUri, name: panName, type: 'image/jpeg' } as any);
        }
        if (businessProofImageUri) {
          const proofName = businessProofImageUri.split('/').pop() || 'proof.jpg';
          kycData.append('businessProofImage', { uri: businessProofImageUri, name: proofName, type: 'image/jpeg' } as any);
        }
        if (bankProofImageUri) {
          const bankProofName = bankProofImageUri.split('/').pop() || 'bankproof.jpg';
          kycData.append('bankProofImage', { uri: bankProofImageUri, name: bankProofName, type: 'image/jpeg' } as any);
        }
        
        await api.put(`merchant/${merchantId}/kyc`, kycData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 4. Submit Operating Hours
      await api.put(`merchant/${merchantId}/operating-hours`, {
        openTime,
        closeTime,
        daysOpen,
      });

      // 5. Activate verification status
      const response = await api.put(`merchant/${merchantId}/activate`);
      if (response.data?.success) {
        const updated = response.data?.merchant;
        updateMerchantState({
          status: updated?.status || 'pending_verification',
          rejectionReason: '',
          isActive: !!updated?.isActive,
        });
        router.replace('/pending-verification');
      } else {
        throw new Error(response.data?.message || 'Failed to submit verification request.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Onboarding submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleGender = (g: string) => {
    if (genderCategory.includes(g)) {
      setGenderCategory(genderCategory.filter((x) => x !== g));
    } else {
      setGenderCategory([...genderCategory, g]);
    }
  };

  const toggleDay = (d: string) => {
    if (daysOpen.includes(d)) {
      setDaysOpen(daysOpen.filter((x) => x !== d));
    } else {
      setDaysOpen([...daysOpen, d]);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        {STEPS.map((s) => (
          <View key={s.id} style={styles.stepIndicatorWrapper}>
            <View
              style={[
                styles.stepBubble,
                currentStep === s.id && styles.activeBubble,
                currentStep > s.id && styles.completedBubble,
              ]}
            >
              {currentStep > s.id ? (
                <Check size={14} color="#FFFFFF" />
              ) : (
                <Text style={[styles.stepNumText, currentStep === s.id && styles.activeNumText]}>
                  {s.id}
                </Text>
              )}
            </View>
            <Text style={[styles.stepText, currentStep === s.id && styles.activeStepText]}>
              {s.title}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        scrollEnabled={parentScrollEnabled}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isPending && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerTitle}>⏳ Verification Pending</Text>
            <Text style={styles.pendingBannerText}>
              Your shop registration details are under review. You can view your submitted details below.
            </Text>
            <TouchableOpacity style={styles.bannerLogoutBtn} onPress={logout}>
              <Text style={styles.bannerLogoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {isRejected && (
          <View style={styles.rejectBanner}>
            <Text style={styles.rejectBannerTitle}>❌ Correction Required</Text>
            <Text style={styles.rejectBannerText}>
              Please correct the flagged details in the steps below. Once corrected, proceed to Step 4 and tap &quot;Submit Onboarding&quot; to resubmit.
            </Text>
            <Text style={styles.rejectReasonBox}>
              {merchant?.rejectionReason || "Details not specified."}
            </Text>
            <TouchableOpacity style={styles.bannerLogoutBtn} onPress={logout}>
              <Text style={styles.bannerLogoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Step 1: Shop details */}
        {currentStep === 1 && (
          <View style={styles.stepContainer} pointerEvents={isPending ? 'none' : 'auto'}>
            <Text style={styles.stepTitle}>Shop & Owner Setup</Text>

            <Text style={styles.label}>Shop Name *</Text>
            <TextInput style={styles.input} placeholder="Official Shop Name" value={shopName} onChangeText={setShopName} />

            <Text style={styles.label}>Shop Description</Text>
            <TextInput
              style={[styles.input, { height: 80, paddingVertical: 12 }]}
              placeholder="Tell customers about your store"
              multiline
              value={shopDescription}
              onChangeText={setShopDescription}
            />

            <Text style={styles.label}>Owner Name *</Text>
            <TextInput style={styles.input} placeholder="Full Name" value={ownerName} onChangeText={setOwnerName} />

            <Text style={styles.label}>Store Mobile Number *</Text>
            <TextInput style={styles.input} placeholder="Store Mobile Number for Customer Contact" value={storeMobileNumber} onChangeText={setStoreMobileNumber} keyboardType="phone-pad" />

            <Text style={styles.label}>Pickup Contact Number *</Text>
            <TextInput style={styles.input} placeholder="Pickup Contact Number for Courier Pickup" value={pickupContactNumber} onChangeText={setPickupContactNumber} keyboardType="phone-pad" />

            {/* Business Type is hidden for now
            <Text style={styles.label}>Business Type *</Text>
            <View style={styles.pickerContainer}>
              {BUSINESS_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.pickerPill, businessType === type && styles.activePickerPill]}
                  onPress={() => setBusinessType(type)}
                >
                  <Text style={[styles.pickerPillText, businessType === type && styles.activePickerPillText]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            */}

            <Text style={styles.label}>Gender Categories focus</Text>
            <View style={styles.pickerContainer}>
              {GENDER_CATEGORIES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.pickerPill, genderCategory.includes(g) && styles.activePickerPill]}
                  onPress={() => toggleGender(g)}
                >
                  <Text style={[styles.pickerPillText, genderCategory.includes(g) && styles.activePickerPillText]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Geolocation Section */}
            <View style={styles.locationHeaderRow}>
              <Text style={styles.label}>Shop Location Mapping *</Text>
              {latitude && longitude ? (
                <View style={styles.liveCoordBadge}>
                  <View style={styles.liveCoordDot} />
                  <Text style={styles.liveCoordText}>Pin Set</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.locationContainer}>
              {/* Clean unified search & GPS bar */}
              <View style={styles.mapSearchBar}>
                <Search size={18} color="#64748B" style={{ marginLeft: 12, marginRight: 8 }} />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search market, area, landmark..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearchAddress}
                  returnKeyType="search"
                />
                {isSearching ? (
                  <ActivityIndicator size="small" color="#0F172A" style={{ marginRight: 8 }} />
                ) : (
                  <TouchableOpacity
                    style={styles.mapSearchActionBtn}
                    onPress={handleSearchAddress}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.mapSearchActionText}>Search</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.mapGpsActionBtn, isLocating && styles.mapGpsActionBtnActive]}
                  onPress={handleDetectLocation}
                  disabled={isLocating}
                  activeOpacity={0.7}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Locate size={17} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Informative gesture guidance pill */}
              <View style={styles.mapGuidePill}>
                <Text style={styles.mapGuideText}>
                  📍 Drag map to position pin at your store entrance, or tap anywhere on map
                </Text>
              </View>

              {/* Interactive Map View Card */}
              <View
                style={styles.mapCard}
                onTouchStart={() => setParentScrollEnabled(false)}
                onTouchEnd={() => setParentScrollEnabled(true)}
                onTouchCancel={() => setParentScrollEnabled(true)}
              >
                {Platform.OS !== 'web' ? (
                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={{
                      latitude: parseFloat(latitude) || 20.5937,
                      longitude: parseFloat(longitude) || 78.9629,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    showsCompass={true}
                    rotateEnabled={true}
                    scrollEnabled={true}
                    zoomEnabled={true}
                    onPanDrag={() => {
                      setParentScrollEnabled(false);
                      if (!isMapPanning) setIsMapPanning(true);
                    }}
                    onRegionChange={() => {
                      if (!isMapPanning) setIsMapPanning(true);
                    }}
                    onRegionChangeComplete={handleRegionChangeComplete}
                    onPress={handleMapPress}
                  />
                ) : (
                  <View style={styles.webFallbackBox}>
                    <Text style={styles.webFallbackTitle}>📍 Shop Coordinates</Text>
                    <Text style={styles.webFallbackCoords}>
                      {latitude && longitude ? `${latitude}, ${longitude}` : 'No location detected yet'}
                    </Text>
                    <TouchableOpacity style={styles.webGpsBtn} onPress={handleDetectLocation}>
                      <Text style={styles.webGpsBtnText}>Use Device GPS</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Animated Fixed Center Pin */}
                {Platform.OS !== 'web' && (
                  <View style={styles.centerPinContainer} pointerEvents="none">
                    <Animated.View
                      style={[
                        styles.centerPinWrapper,
                        { transform: [{ translateY: pinLiftAnim }] },
                      ]}
                    >
                      <View style={styles.pinTooltip}>
                        <Text style={styles.pinTooltipText}>Store Pin</Text>
                      </View>
                      <View style={styles.pinMarkerBody}>
                        <MapPin size={30} color="#E11D48" fill="#E11D48" />
                      </View>
                    </Animated.View>
                    <View style={styles.pinShadow} />
                  </View>
                )}

                {/* Floating Map Controls */}
                <View style={styles.mapTopControls} pointerEvents="box-none">
                  <TouchableOpacity
                    style={styles.expandMapBtn}
                    onPress={() => setShowFullMapModal(true)}
                    activeOpacity={0.85}
                  >
                    <Maximize2 size={14} color="#0F172A" style={{ marginRight: 4 }} />
                    <Text style={styles.expandMapBtnText}>Full Screen</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Floating GPS Recenter FAB on Map */}
                <TouchableOpacity
                  style={styles.mapGpsFab}
                  onPress={handleDetectLocation}
                  disabled={isLocating}
                  activeOpacity={0.85}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <Locate size={18} color="#0F172A" />
                  )}
                </TouchableOpacity>

                {/* Bottom Coordinates & Address Status Bar */}
                <View style={styles.mapFooterBar}>
                  <Text style={styles.mapFooterCoords} numberOfLines={1}>
                    {latitude && longitude
                      ? `GPS: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
                      : 'Move map to pinpoint exact store location'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Address fields */}
            <Text style={styles.label}>Street Address *</Text>
            <TextInput style={styles.input} placeholder="Building, Street, Area" value={street} onChangeText={setStreet} />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>City *</Text>
                <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Pincode *</Text>
                <TextInput style={styles.input} placeholder="6-digit ZIP code" value={postalCode} onChangeText={setPostalCode} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>State</Text>
                <TextInput style={styles.input} placeholder="State" value={state} onChangeText={setState} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Landmark</Text>
                <TextInput style={styles.input} placeholder="Landmark" value={landmark} onChangeText={setLandmark} />
              </View>
            </View>

            <Text style={styles.label}>Address Note</Text>
            <TextInput style={styles.input} placeholder="Floor, Suite, or Delivery Instructions" value={addressNote} onChangeText={setAddressNote} />


            {/* Media Uploads */}
            <Text style={styles.label}>Shop Logo Image *</Text>
            <TouchableOpacity style={styles.imagePlaceholderBox} onPress={() => handlePickImage(setLogoUri)}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadInner}>
                  <Upload size={24} color="#64748B" />
                  <Text style={styles.uploadText}>Upload Square Logo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Background Banner Image (16:9)</Text>
            <TouchableOpacity style={styles.imagePlaceholderBox} onPress={() => handlePickImage(setBannerUri)}>
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadInner}>
                  <Upload size={24} color="#64748B" />
                  <Text style={styles.uploadText}>Upload Wide Banner</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Courier Section */}
            <View style={styles.courierCard}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courierTitle}>Courier Delivery</Text>
                  <Text style={styles.courierSub}>Support standard long-distance shipping</Text>
                </View>
                <Switch value={enableCourier} onValueChange={setEnableCourier} />
              </View>

              {enableCourier && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.label}>Ships Within (Hours)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="24"
                    value={shipsWithinHours}
                    onChangeText={setShipsWithinHours}
                    keyboardType="numeric"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Accept Returns</Text>
                    <Switch value={acceptsReturns} onValueChange={setAcceptsReturns} />
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Step 2: Bank details */}
        {currentStep === 2 && (
          <View style={styles.stepContainer} pointerEvents={isPending ? 'none' : 'auto'}>
            <Text style={styles.stepTitle}>Bank Details</Text>
            <Text style={styles.stepSub}>Settlements will be processed to this account.</Text>

            <Text style={styles.label}>Bank Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. HDFC Bank" value={bankName} onChangeText={setBankName} />

            <Text style={styles.label}>Account Holder Name *</Text>
            <TextInput style={styles.input} placeholder="As on bank passbook" value={accountHolderName} onChangeText={setAccountHolderName} />

            <Text style={styles.label}>Account Number *</Text>
            <TextInput style={styles.input} placeholder="0000 0000 0000 0000" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />

            <Text style={styles.label}>Confirm Account Number *</Text>
            <TextInput style={styles.input} placeholder="Re-enter Account Number" value={confirmAccountNumber} onChangeText={setConfirmAccountNumber} keyboardType="numeric" />

            <Text style={styles.label}>IFSC Code *</Text>
            <TextInput style={styles.input} placeholder="e.g. HDFC0001234" value={ifscCode} onChangeText={setIfscCode} autoCapitalize="characters" />

            <Text style={styles.label}>UPI ID (Optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. shopname@upi" value={upiId} onChangeText={setUpiId} autoCapitalize="none" />
          </View>
        )}

        {/* Step 3: KYC Details */}
        {currentStep === 3 && (
          <View style={styles.stepContainer} pointerEvents={isPending ? 'none' : 'auto'}>
            <Text style={styles.stepTitle}>KYC Verification Docs</Text>

            <Text style={styles.label}>PAN Card Number *</Text>
            <TextInput style={styles.input} placeholder="ABCDE1234F" value={panNumber} onChangeText={setPanNumber} autoCapitalize="characters" />

            <Text style={styles.label}>PAN Card Document Image *</Text>
            <TouchableOpacity style={styles.imagePlaceholderBox} onPress={() => handlePickImage(setPanImageUri)}>
              {panImageUri ? (
                <Image source={{ uri: panImageUri }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadInner}>
                  <Camera size={24} color="#64748B" />
                  <Text style={styles.uploadText}>Capture PAN Card Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>GST Number (Optional)</Text>
            <TextInput style={styles.input} placeholder="27ABCDE1234F1Z5" value={gstNumber} onChangeText={setGstNumber} autoCapitalize="characters" />

            <Text style={styles.label}>Bank Account Proof (Cheque/Passbook)</Text>
            <TouchableOpacity style={styles.imagePlaceholderBox} onPress={() => handlePickImage(setBankProofImageUri)}>
              {bankProofImageUri ? (
                <Image source={{ uri: bankProofImageUri }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadInner}>
                  <Camera size={24} color="#64748B" />
                  <Text style={styles.uploadText}>Capture Passbook/Cancel Cheque Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4: Operational setup */}
        {currentStep === 4 && (
          <View style={styles.stepContainer} pointerEvents={isPending ? 'none' : 'auto'}>
            <Text style={styles.stepTitle}>Operating Setup</Text>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Opening Time</Text>
                <TextInput style={styles.input} placeholder="e.g. 09:00" value={openTime} onChangeText={setOpenTime} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Closing Time</Text>
                <TextInput style={styles.input} placeholder="e.g. 21:00" value={closeTime} onChangeText={setCloseTime} />
              </View>
            </View>

            <Text style={styles.label}>Days Open</Text>
            <View style={styles.pickerContainer}>
              {DAYS_OF_WEEK.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pickerPill, daysOpen.includes(d) && styles.activePickerPill]}
                  onPress={() => toggleDay(d)}
                >
                  <Text style={[styles.pickerPillText, daysOpen.includes(d) && styles.activePickerPillText]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Verification prompt before activation */}
            <Text style={styles.infoNote}>
              Double-check all information before submitting. After submission, documents will lock for verification.
            </Text>

            {/* Terms and Conditions Acceptance */}
            <TouchableOpacity
              style={styles.termsAgreementCard}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.8}
            >
              <View style={[styles.termsCheckbox, termsAccepted && styles.termsCheckboxActive]}>
                {termsAccepted && <Check size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsAgreementText}>
                I have read, understood and agree to the{' '}
                <Text
                  style={styles.termsLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push('/policies' as any);
                  }}
                >
                  FlashFits Merchant Partner Agreement, Return & Damage Policy, and Payout Terms
                </Text>
                .
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form control buttons */}
        <View style={styles.navigationRow}>
          {currentStep > 1 ? (
            <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(currentStep - 1)}>
              <ChevronRight size={18} color="#1A1A1A" style={{ transform: [{ rotate: '180deg' }] }} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.backBtn} onPress={logout} disabled={loading}>
              <Text style={[styles.backBtnText, { color: '#EF4444' }]}>Log Out</Text>
            </TouchableOpacity>
          )}

          {(currentStep === 2 || currentStep === 3) && !isPending && (
            <TouchableOpacity 
              style={[styles.backBtn, { flex: 1, backgroundColor: '#F8FAFC' }]} 
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={[styles.backBtnText, { fontSize: 13 }]}>Skip</Text>
            </TouchableOpacity>
          )}

          {currentStep === 4 && isPending ? (
            <View style={[styles.nextBtn, { backgroundColor: '#F1F5F9' }]}>
              <Text style={[styles.nextBtnText, { color: '#64748B' }]}>Under Review</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>{currentStep === 4 ? 'Submit Onboarding' : 'Next'}</Text>
                  {currentStep < 4 && <ChevronRight size={18} color="#FFFFFF" />}
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Full-Screen Map Modal for Precision Pinning */}
      <Modal
        visible={showFullMapModal}
        animationType="slide"
        onRequestClose={() => setShowFullMapModal(false)}
      >
        <View style={styles.fullModalContainer}>
          {/* Header */}
          <View style={styles.fullModalHeader}>
            <TouchableOpacity
              style={styles.fullModalCloseBtn}
              onPress={() => setShowFullMapModal(false)}
              activeOpacity={0.7}
            >
              <X size={22} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text style={styles.fullModalTitle}>Set Store Location</Text>
              <Text style={styles.fullModalSubtitle}>Drag map to position pin at store entrance</Text>
            </View>
          </View>

          {/* Search bar inside Modal */}
          <View style={styles.fullModalSearchWrapper}>
            <View style={styles.fullModalSearchBar}>
              <Search size={18} color="#64748B" style={{ marginLeft: 12, marginRight: 8 }} />
              <TextInput
                style={styles.fullModalSearchInput}
                placeholder="Search city, area, or landmark..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchAddress}
                returnKeyType="search"
              />
              {isSearching ? (
                <ActivityIndicator size="small" color="#0F172A" style={{ marginRight: 10 }} />
              ) : (
                <TouchableOpacity
                  style={styles.fullModalSearchAction}
                  onPress={handleSearchAddress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fullModalSearchActionText}>Search</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Full Screen Map */}
          <View style={styles.fullMapWrapper}>
            {Platform.OS !== 'web' ? (
              <MapView
                ref={fullMapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude: parseFloat(latitude) || 20.5937,
                  longitude: parseFloat(longitude) || 78.9629,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsCompass={true}
                rotateEnabled={true}
                scrollEnabled={true}
                zoomEnabled={true}
                onPanDrag={() => {
                  if (!isMapPanning) setIsMapPanning(true);
                }}
                onRegionChange={() => {
                  if (!isMapPanning) setIsMapPanning(true);
                }}
                onRegionChangeComplete={handleRegionChangeComplete}
                onPress={handleMapPress}
              />
            ) : null}

            {/* Center Pin in Modal */}
            <View style={styles.centerPinContainerModal} pointerEvents="none">
              <Animated.View
                style={[
                  styles.centerPinWrapper,
                  { transform: [{ translateY: pinLiftAnim }] },
                ]}
              >
                <View style={styles.pinTooltip}>
                  <Text style={styles.pinTooltipText}>Store Pin</Text>
                </View>
                <View style={styles.pinMarkerBody}>
                  <MapPin size={34} color="#E11D48" fill="#E11D48" />
                </View>
              </Animated.View>
              <View style={styles.pinShadow} />
            </View>

            {/* GPS FAB in Modal */}
            <TouchableOpacity
              style={styles.fullModalGpsFab}
              onPress={handleDetectLocation}
              disabled={isLocating}
              activeOpacity={0.85}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <Locate size={22} color="#0F172A" />
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Confirmation Card */}
          <View style={styles.fullModalBottomCard}>
            <View style={styles.bottomInfoRow}>
              <MapPin size={22} color="#E11D48" style={{ marginTop: 2, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bottomPlaceTitle} numberOfLines={1}>
                  {street || city ? [street, city].filter(Boolean).join(', ') : 'Selected Location'}
                </Text>
                <Text style={styles.bottomPlaceCoords} numberOfLines={1}>
                  {latitude && longitude
                    ? `GPS: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
                    : 'Drag map to place pin at store'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmLocationBtn}
              onPress={handleConfirmModalLocation}
              activeOpacity={0.85}
            >
              <Check size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.confirmLocationBtnText}>Confirm Store Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  progressHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  stepIndicatorWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeBubble: {
    backgroundColor: '#1A1A1A',
  },
  completedBubble: {
    backgroundColor: '#3B82F6',
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  activeNumText: {
    color: '#FFFFFF',
  },
  stepText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  activeStepText: {
    color: '#1A1A1A',
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
  stepContainer: {
    width: '100%',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  stepSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  pickerPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  activePickerPill: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  pickerPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  activePickerPillText: {
    color: '#FFFFFF',
  },
  locationContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveCoordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 16,
  },
  liveCoordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 5,
  },
  liveCoordText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  mapSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingRight: 6,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  mapSearchActionBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
  },
  mapSearchActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  mapGpsActionBtn: {
    backgroundColor: '#0F172A',
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapGpsActionBtnActive: {
    backgroundColor: '#E11D48',
  },
  mapGuidePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  mapGuideText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
    fontWeight: '500',
  },
  imagePlaceholderBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  courierCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courierTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  courierSub: {
    fontSize: 11,
    color: '#64748B',
  },
  infoNote: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
    height: 52,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    flex: 2,
    height: 52,
    borderRadius: 12,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  pendingBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  pendingBannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#D97706',
    marginBottom: 6,
  },
  pendingBannerText: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  rejectBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  rejectBannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#B91C1C',
    marginBottom: 6,
  },
  rejectBannerText: {
    fontSize: 13,
    color: '#991B1C',
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  rejectReasonBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#7F1D1D',
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 12,
  },
  bannerLogoutBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  bannerLogoutText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  mapCard: {
    height: 280,
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  centerPinContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinContainerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTooltip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  pinTooltipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pinMarkerBody: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinShadow: {
    width: 14,
    height: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    marginTop: -3,
  },
  mapTopControls: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  expandMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expandMapBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  mapGpsFab: {
    position: 'absolute',
    bottom: 38,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapFooterBar: {
    height: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  mapFooterCoords: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  webFallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  webFallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  webFallbackCoords: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  webGpsBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  webGpsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  fullModalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  fullModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  fullModalSearchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  fullModalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 44,
    paddingRight: 6,
  },
  fullModalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  fullModalSearchAction: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
  },
  fullModalSearchActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  fullMapWrapper: {
    flex: 1,
    position: 'relative',
  },
  fullModalGpsFab: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fullModalBottomCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  bottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bottomPlaceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomPlaceCoords: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  confirmLocationBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLocationBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  termsAgreementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
    marginBottom: 6,
    gap: 12,
  },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  termsCheckboxActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  termsAgreementText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  termsLink: {
    color: '#0F172A',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
