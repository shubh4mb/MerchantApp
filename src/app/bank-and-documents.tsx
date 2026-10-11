import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  CreditCard,
  Shield,
  CheckCircle,
  AlertCircle,
  Upload,
} from 'lucide-react-native';

const PROOF_TYPES = [
  { id: 'shop_license', label: 'Shop & Establishment License' },
  { id: 'gst_cert', label: 'GST Certificate' },
  { id: 'udyam', label: 'Udyam Registration (MSME)' },
  { id: 'rent_agreement', label: 'Rental Agreement' },
];

export default function BankAndDocumentsScreen() {
  const { merchant, updateMerchantState } = useAuth();
  const router = useRouter();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bank' | 'kyc'>('bank');
  const [fullMerchant, setFullMerchant] = useState<any>(null);

  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
  });

  const [kycForm, setKycForm] = useState({
    panNumber: '',
    panImageUri: '',
    gstNumber: '',
    businessProofType: '',
    businessProofImageUri: '',
    bankProofImageUri: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await api.get('merchant/getMerchant');
      const data = res.data?.merchant || res.data;
      if (data) {
        setFullMerchant(data);
        setBankForm({
          accountHolderName: data.bankDetails?.accountHolderName || '',
          accountNumber: data.bankDetails?.accountNumber || '',
          confirmAccountNumber: data.bankDetails?.accountNumber || '',
          ifscCode: data.bankDetails?.ifscCode || '',
          bankName: data.bankDetails?.bankName || '',
          upiId: data.bankDetails?.upiId || '',
        });
        setKycForm({
          panNumber: data.kyc?.pan?.number || '',
          panImageUri: '',
          gstNumber: data.kyc?.gst?.number || '',
          businessProofType: data.kyc?.businessProof?.proofType || '',
          businessProofImageUri: '',
          bankProofImageUri: '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load details. Please try again.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const pickImage = async (field: keyof typeof kycForm) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery permissions to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setKycForm({ ...kycForm, [field]: result.assets[0].uri });
    }
  };

  const saveBankDetails = async () => {
    if (!bankForm.bankName.trim() || !bankForm.accountHolderName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifscCode.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in all mandatory bank details.');
      return;
    }

    if (bankForm.accountNumber !== bankForm.confirmAccountNumber) {
      Alert.alert('Mismatch', 'Account numbers do not match.');
      return;
    }

    try {
      setSavingSection('bank');
      const res = await api.put(`merchant/${merchant?.id}/bank-details`, {
        bankName: bankForm.bankName.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        ifscCode: bankForm.ifscCode.trim().toUpperCase(),
        accountHolderName: bankForm.accountHolderName.trim(),
        upiId: bankForm.upiId.trim(),
      });
      
      if (res.data?.merchant) {
        updateMerchantState({
          status: res.data.merchant.status,
          rejectionReason: res.data.merchant.rejectionReason,
        });
      }

      Alert.alert('Success', 'Bank details submitted successfully. Verification will be processed by our admin team.');
      fetchProfile();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update bank details.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveKycDetails = async () => {
    if (!kycForm.panNumber.trim() && !fullMerchant?.kyc?.pan?.verified) {
      Alert.alert('Incomplete Form', 'PAN Number is required.');
      return;
    }

    try {
      setSavingSection('kyc');
      const formData = new FormData();
      formData.append('panNumber', kycForm.panNumber.trim().toUpperCase());
      formData.append('gstNumber', kycForm.gstNumber.trim().toUpperCase());
      if (kycForm.businessProofType) {
        formData.append('businessProofType', kycForm.businessProofType);
      }

      if (kycForm.panImageUri) {
        formData.append('panImage', { uri: kycForm.panImageUri, name: 'pan.jpg', type: 'image/jpeg' } as any);
      }
      if (kycForm.businessProofImageUri) {
        formData.append('businessProofImage', { uri: kycForm.businessProofImageUri, name: 'proof.jpg', type: 'image/jpeg' } as any);
      }
      if (kycForm.bankProofImageUri) {
        formData.append('bankProofImage', { uri: kycForm.bankProofImageUri, name: 'bankproof.jpg', type: 'image/jpeg' } as any);
      }

      const res = await api.put(`merchant/${merchant?.id}/kyc`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.merchant) {
        updateMerchantState({
          status: res.data.merchant.status,
          rejectionReason: res.data.merchant.rejectionReason,
        });
      }

      Alert.alert('Success', 'KYC documents submitted successfully. Verification will be processed by our admin team.');
      fetchProfile();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit KYC documents.');
    } finally {
      setSavingSection(null);
    }
  };

  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  const isBankComplete = fullMerchant?.bankDetails?.accountNumber;
  const isKycComplete = fullMerchant?.kyc?.pan?.verified;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Status Banner */}
        {fullMerchant?.rejectionReason ? (
          <View style={styles.rejectionBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertCircle size={18} color="#DC2626" />
              <Text style={styles.rejectionBannerTitle}>Action Required / Flagged by Admin</Text>
            </View>
            <Text style={styles.rejectionBannerText}>{fullMerchant.rejectionReason}</Text>
          </View>
        ) : (
          <View style={styles.statusBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusBannerTitle}>Verification Status</Text>
              <Text style={styles.statusBannerSubtitle}>
                {isBankComplete && isKycComplete 
                  ? 'Your bank and KYC details are submitted.' 
                  : 'Please complete your bank and document verification to receive payouts without interruption.'}
              </Text>
            </View>
            {(!isBankComplete || !isKycComplete) && <AlertCircle size={24} color="#F59E0B" />}
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab('bank')}
            style={[styles.tabButton, activeTab === 'bank' && styles.tabButtonActive]}
          >
            <CreditCard size={16} color={activeTab === 'bank' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabButtonText, activeTab === 'bank' && styles.tabButtonTextActive]}>Bank Info</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('kyc')}
            style={[styles.tabButton, activeTab === 'kyc' && styles.tabButtonActive]}
          >
            <Shield size={16} color={activeTab === 'kyc' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabButtonText, activeTab === 'kyc' && styles.tabButtonTextActive]}>Documents</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'bank' && (
            <View style={styles.formCard}>
              <Text style={styles.formCardTitle}>Settlement Bank Details</Text>
              <Text style={styles.formDescription}>Enter the bank account where you want to receive your settlements.</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Holder Name *</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.accountHolderName}
                  onChangeText={(val) => setBankForm({ ...bankForm, accountHolderName: val })}
                  placeholder="e.g. John Doe"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bank Name *</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.bankName}
                  onChangeText={(val) => setBankForm({ ...bankForm, bankName: val })}
                  placeholder="e.g. HDFC Bank"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Number *</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.accountNumber}
                  onChangeText={(val) => setBankForm({ ...bankForm, accountNumber: val })}
                  placeholder="Account Number"
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Account Number *</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.confirmAccountNumber}
                  onChangeText={(val) => setBankForm({ ...bankForm, confirmAccountNumber: val })}
                  placeholder="Confirm Account Number"
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>IFSC Code *</Text>
                <TextInput
                  style={[styles.input, { textTransform: 'uppercase' }]}
                  value={bankForm.ifscCode}
                  onChangeText={(val) => setBankForm({ ...bankForm, ifscCode: val })}
                  placeholder="e.g. HDFC0001234"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Settlement UPI ID (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={bankForm.upiId}
                  onChangeText={(val) => setBankForm({ ...bankForm, upiId: val })}
                  placeholder="e.g. yourname@upi"
                />
              </View>
              
              <View style={styles.inputGroup}>
                 <Text style={styles.label}>Bank Passbook / Cancelled Cheque (Optional)</Text>
                 <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('bankProofImageUri')}>
                    <Upload size={20} color="#3B82F6" />
                    <Text style={styles.uploadButtonText}>
                      {kycForm.bankProofImageUri ? 'Change Bank Proof Image' : 'Upload Bank Proof Image'}
                    </Text>
                 </TouchableOpacity>
                 {kycForm.bankProofImageUri && <Text style={styles.successText}>✓ Image selected</Text>}
                 {fullMerchant?.kyc?.bankProof?.verified && <View style={[styles.badge, styles.verifiedBadge]}><CheckCircle size={12} color="#10B981" /><Text style={styles.verifiedText}>VERIFIED</Text></View>}
              </View>

              <TouchableOpacity
                onPress={saveBankDetails}
                disabled={savingSection === 'bank'}
                style={styles.primaryButton}
              >
                {savingSection === 'bank' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Bank Details</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'kyc' && (
            <View style={styles.formCard}>
              <Text style={styles.formCardTitle}>KYC Documents</Text>
              <Text style={styles.formDescription}>Upload your business documents for verification.</Text>

              {/* PAN CARD */}
              <View style={styles.documentSection}>
                <View style={styles.documentHeader}>
                  <Text style={styles.documentTitle}>PAN Card Identity *</Text>
                  {fullMerchant?.kyc?.pan?.verified ? (
                    <View style={[styles.badge, styles.verifiedBadge]}>
                      <CheckCircle size={12} color="#10B981" />
                      <Text style={styles.verifiedText}>VERIFIED</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.pendingBadge]}>
                      <AlertCircle size={12} color="#F59E0B" />
                      <Text style={styles.pendingText}>PENDING</Text>
                    </View>
                  )}
                </View>
                {!fullMerchant?.kyc?.pan?.verified ? (
                  <>
                    <TextInput
                      style={[styles.input, { textTransform: 'uppercase' }]}
                      value={kycForm.panNumber}
                      onChangeText={(val) => setKycForm({ ...kycForm, panNumber: val })}
                      placeholder="PAN Number"
                    />
                    <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('panImageUri')}>
                      <Upload size={20} color="#3B82F6" />
                      <Text style={styles.uploadButtonText}>
                        {kycForm.panImageUri ? 'Change PAN Image' : 'Upload PAN Image'}
                      </Text>
                    </TouchableOpacity>
                    {kycForm.panImageUri && <Text style={styles.successText}>✓ Image selected</Text>}
                  </>
                ) : (
                  <Text style={styles.verifiedValue}>{fullMerchant?.kyc?.pan?.number}</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* GST CERTIFICATE */}
              <View style={styles.documentSection}>
                <View style={styles.documentHeader}>
                  <Text style={styles.documentTitle}>GST Certificate (Optional)</Text>
                  {fullMerchant?.kyc?.gst?.verified ? (
                    <View style={[styles.badge, styles.verifiedBadge]}>
                      <CheckCircle size={12} color="#10B981" />
                      <Text style={styles.verifiedText}>VERIFIED</Text>
                    </View>
                  ) : (
                     fullMerchant?.kyc?.gst?.number ? (
                       <View style={[styles.badge, styles.pendingBadge]}>
                         <AlertCircle size={12} color="#F59E0B" />
                         <Text style={styles.pendingText}>PENDING</Text>
                       </View>
                     ) : null
                  )}
                </View>
                <TextInput
                  style={[styles.input, { textTransform: 'uppercase' }]}
                  value={kycForm.gstNumber}
                  onChangeText={(val) => setKycForm({ ...kycForm, gstNumber: val })}
                  placeholder="GST Number (Optional)"
                />
              </View>
              
              <View style={styles.divider} />

              {/* BUSINESS PROOF */}
              <View style={styles.documentSection}>
                <View style={styles.documentHeader}>
                  <Text style={styles.documentTitle}>Additional Business Proof (Optional)</Text>
                  {fullMerchant?.kyc?.businessProof?.verified ? (
                     <View style={[styles.badge, styles.verifiedBadge]}>
                       <CheckCircle size={12} color="#10B981" />
                       <Text style={styles.verifiedText}>VERIFIED</Text>
                     </View>
                   ) : (
                      fullMerchant?.kyc?.businessProof?.proofType ? (
                        <View style={[styles.badge, styles.pendingBadge]}>
                          <AlertCircle size={12} color="#F59E0B" />
                          <Text style={styles.pendingText}>PENDING</Text>
                        </View>
                      ) : null
                   )}
                </View>
                {!fullMerchant?.kyc?.businessProof?.verified ? (
                   <>
                     <Text style={styles.label}>Select Proof Type</Text>
                     <View style={styles.radioGroup}>
                        {PROOF_TYPES.map((pt) => (
                           <TouchableOpacity 
                             key={pt.id} 
                             style={[styles.radioItem, kycForm.businessProofType === pt.id && styles.radioItemActive]}
                             onPress={() => setKycForm({ ...kycForm, businessProofType: pt.id })}
                           >
                             <Text style={[styles.radioText, kycForm.businessProofType === pt.id && styles.radioTextActive]}>{pt.label}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                     <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('businessProofImageUri')}>
                        <Upload size={20} color="#3B82F6" />
                        <Text style={styles.uploadButtonText}>
                          {kycForm.businessProofImageUri ? 'Change Proof Image' : 'Upload Proof Image'}
                        </Text>
                     </TouchableOpacity>
                     {kycForm.businessProofImageUri && <Text style={styles.successText}>✓ Image selected</Text>}
                   </>
                ) : (
                   <Text style={styles.verifiedValue}>{PROOF_TYPES.find(p => p.id === fullMerchant?.kyc?.businessProof?.proofType)?.label || 'Verified Proof'}</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={saveKycDetails}
                disabled={savingSection === 'kyc'}
                style={[styles.primaryButton, { marginTop: 20 }]}
              >
                {savingSection === 'kyc' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Submit Documents</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  statusBannerSubtitle: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: '#1A1A1A',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  formCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  formDescription: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
    color: '#1A1A1A',
  },
  primaryButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  documentSection: {
    marginBottom: 20,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedBadge: {
    backgroundColor: '#D1FAE5',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  verifiedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    marginTop: 12,
    gap: 8,
  },
  uploadButtonText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
  successText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  radioItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radioItemActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  radioText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  radioTextActive: {
    color: '#FFFFFF',
  },
  rejectionBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  rejectionBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  rejectionBannerText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontWeight: '500',
  },
});
