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
  Linking,
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
  Edit3,
  Eye,
  EyeOff,
  Lock,
  Phone,
  Clock,
  FileText,
  Check,
} from 'lucide-react-native';

const maskAccountNumber = (acc: string) => {
  if (!acc) return '—';
  if (acc.length <= 4) return acc;
  const last4 = acc.slice(-4);
  return `•••• •••• •••• ${last4}`;
};

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
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [showFullAccount, setShowFullAccount] = useState(false);

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
    gstImageUri: '',
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
        const hasExistingBank = Boolean(data.bankDetails?.accountNumber);
        setBankForm({
          accountHolderName: data.bankDetails?.accountHolderName || '',
          accountNumber: data.bankDetails?.accountNumber || '',
          confirmAccountNumber: data.bankDetails?.accountNumber || '',
          ifscCode: data.bankDetails?.ifscCode || '',
          bankName: data.bankDetails?.bankName || '',
          upiId: data.bankDetails?.upiId || '',
        });
        if (hasExistingBank) {
          setIsEditingBank(false);
        } else {
          setIsEditingBank(true);
        }
        setKycForm({
          panNumber: data.kyc?.pan?.number || '',
          panImageUri: '',
          gstNumber: data.kyc?.gst?.number || '',
          gstImageUri: '',
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
      setIsEditingBank(false);
      fetchProfile();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update bank details.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveKycDetails = async () => {
    const panVerified = fullMerchant?.kyc?.pan?.verified;
    const panSubmitted = !!(fullMerchant?.kyc?.pan?.number || fullMerchant?.kyc?.pan?.image?.url);

    if (!panVerified && !panSubmitted && !kycForm.panNumber.trim() && !kycForm.panImageUri) {
      Alert.alert('Incomplete Form', 'PAN Card Number and Image are required for statutory verification.');
      return;
    }

    try {
      setSavingSection('kyc');
      const formData = new FormData();
      if (kycForm.panNumber.trim()) {
        formData.append('panNumber', kycForm.panNumber.trim().toUpperCase());
      }
      if (kycForm.gstNumber.trim()) {
        formData.append('gstNumber', kycForm.gstNumber.trim().toUpperCase());
      }
      if (kycForm.businessProofType) {
        formData.append('businessProofType', kycForm.businessProofType);
      }

      if (kycForm.panImageUri) {
        const panName = kycForm.panImageUri.split('/').pop() || 'pan.jpg';
        formData.append('panImage', { uri: kycForm.panImageUri, name: panName, type: 'image/jpeg' } as any);
      }
      if (kycForm.gstImageUri) {
        const gstName = kycForm.gstImageUri.split('/').pop() || 'gst.jpg';
        formData.append('gstImage', { uri: kycForm.gstImageUri, name: gstName, type: 'image/jpeg' } as any);
      }
      if (kycForm.businessProofImageUri) {
        const proofName = kycForm.businessProofImageUri.split('/').pop() || 'proof.jpg';
        formData.append('businessProofImage', { uri: kycForm.businessProofImageUri, name: proofName, type: 'image/jpeg' } as any);
      }
      if (kycForm.bankProofImageUri) {
        const bankProofName = kycForm.bankProofImageUri.split('/').pop() || 'bankproof.jpg';
        formData.append('bankProofImage', { uri: kycForm.bankProofImageUri, name: bankProofName, type: 'image/jpeg' } as any);
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

      Alert.alert('Submitted', 'Documents submitted successfully. Verification will be processed by our admin team.');
      fetchProfile();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit KYC documents.');
    } finally {
      setSavingSection(null);
    }
  };

  const getDocumentStatus = (docData: any, docNameKey: string): 'verified' | 'under_review' | 'rejected' | 'not_submitted' => {
    const isVerified = Boolean(docData?.verified);
    if (isVerified) return 'verified';

    const hasData = Boolean(docData?.number || docData?.proofType || docData?.image?.url);
    const isRejected = fullMerchant?.status === 'rejected';

    if (isRejected && hasData) {
      const reason = (fullMerchant?.rejectionReason || '').toLowerCase();
      if (
        reason.includes(docNameKey) ||
        reason.includes('document') ||
        reason.includes('proof') ||
        reason.includes('kyc') ||
        !reason
      ) {
        return 'rejected';
      }
    }

    if (hasData) return 'under_review';
    return 'not_submitted';
  };

  const renderDocBadge = (status: 'verified' | 'under_review' | 'rejected' | 'not_submitted') => {
    if (status === 'verified') {
      return (
        <View style={[styles.badge, styles.verifiedBadge]}>
          <CheckCircle size={12} color="#10B981" />
          <Text style={styles.verifiedText}>VERIFIED</Text>
        </View>
      );
    }
    if (status === 'under_review') {
      return (
        <View style={[styles.badge, styles.pendingBadge]}>
          <Clock size={12} color="#D97706" />
          <Text style={styles.pendingText}>UNDER REVIEW</Text>
        </View>
      );
    }
    if (status === 'rejected') {
      return (
        <View style={[styles.badge, styles.rejectedBadge]}>
          <AlertCircle size={12} color="#DC2626" />
          <Text style={styles.rejectedText}>ACTION REQUIRED</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.notProvidedBadge]}>
        <Text style={styles.notProvidedText}>NOT SUBMITTED</Text>
      </View>
    );
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
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.formCardTitle}>Settlement Bank Details</Text>
                  <Text style={styles.formDescription}>
                    {isEditingBank
                      ? 'Update the bank account where you receive settlements.'
                      : 'Your registered account for FlashFits payouts.'}
                  </Text>
                </View>
                {!isEditingBank && isBankComplete && !fullMerchant?.bankDetails?.isBankVerified && (
                  <TouchableOpacity
                    style={styles.headerEditBtn}
                    onPress={() => setIsEditingBank(true)}
                  >
                    <Edit3 size={14} color="#1A1A1A" />
                    <Text style={styles.headerEditBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {!isEditingBank && isBankComplete && fullMerchant?.bankDetails?.isBankVerified && (
                  <View style={styles.lockedBadge}>
                    <Lock size={12} color="#64748B" />
                    <Text style={styles.lockedBadgeText}>Locked</Text>
                  </View>
                )}
              </View>

              {!isEditingBank && isBankComplete ? (
                /* READ-ONLY / VIEW MODE */
                <View>
                  <View style={styles.bankStatusCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={styles.bankIconCircle}>
                          <CreditCard size={18} color="#1E293B" />
                        </View>
                        <View>
                          <Text style={styles.bankCardBankName}>{bankForm.bankName || 'Bank Account'}</Text>
                          <Text style={styles.bankCardHolderName}>{bankForm.accountHolderName}</Text>
                        </View>
                      </View>
                      {fullMerchant?.bankDetails?.isBankVerified ? (
                        <View style={[styles.badge, styles.verifiedBadge]}>
                          <CheckCircle size={12} color="#10B981" />
                          <Text style={styles.verifiedText}>VERIFIED</Text>
                        </View>
                      ) : (
                        <View style={[styles.badge, styles.pendingBadge]}>
                          <AlertCircle size={12} color="#F59E0B" />
                          <Text style={styles.pendingText}>UNDER REVIEW</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.viewRow}>
                      <Text style={styles.viewLabel}>Account Number</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.viewValue}>
                          {showFullAccount ? bankForm.accountNumber : maskAccountNumber(bankForm.accountNumber)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowFullAccount(!showFullAccount)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          {showFullAccount ? <EyeOff size={16} color="#64748B" /> : <Eye size={16} color="#64748B" />}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.viewDivider} />

                    <View style={styles.viewRow}>
                      <Text style={styles.viewLabel}>IFSC Code</Text>
                      <Text style={[styles.viewValue, { textTransform: 'uppercase' }]}>{bankForm.ifscCode || '—'}</Text>
                    </View>

                    {bankForm.upiId ? (
                      <>
                        <View style={styles.viewDivider} />
                        <View style={styles.viewRow}>
                          <Text style={styles.viewLabel}>Settlement UPI ID</Text>
                          <Text style={styles.viewValue}>{bankForm.upiId}</Text>
                        </View>
                      </>
                    ) : null}

                    <View style={styles.viewDivider} />
                    <View style={styles.viewRow}>
                      <Text style={styles.viewLabel}>Bank Proof (Cheque/Passbook)</Text>
                      {fullMerchant?.kyc?.bankProof?.verified ? (
                        <View style={[styles.badge, styles.verifiedBadge]}>
                          <CheckCircle size={12} color="#10B981" />
                          <Text style={styles.verifiedText}>VERIFIED</Text>
                        </View>
                      ) : fullMerchant?.kyc?.bankProof?.image?.url ? (
                        <View style={[styles.badge, styles.pendingBadge]}>
                          <Clock size={12} color="#D97706" />
                          <Text style={styles.pendingText}>UNDER REVIEW</Text>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => setActiveTab('kyc')}>
                          <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700' }}>+ Upload in Documents</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {fullMerchant?.bankDetails?.isBankVerified ? (
                    <View style={styles.contactSupportCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Lock size={16} color="#64748B" />
                        <Text style={styles.contactSupportTitle}>Bank Details Locked</Text>
                      </View>
                      <Text style={styles.contactSupportDesc}>
                        Your bank details have been verified and are locked for security. To update them, please contact our support team.
                      </Text>
                      <TouchableOpacity
                        style={styles.contactSupportBtn}
                        onPress={() => {
                          Alert.alert(
                            'Contact Support',
                            'You can reach FlashFits support via:\n\n📧 Email: support@flashfits.com\n📞 Phone: +91-XXXXXXXXXX\n\nPlease include your registered email and reason for the bank detail change.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@flashfits.com?subject=Bank%20Detail%20Change%20Request&body=Merchant%20ID:%20' + (merchant?.id || '')) },
                            ]
                          );
                        }}
                      >
                        <Phone size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.contactSupportBtnText}>Contact Support</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.editFullButton}
                      onPress={() => setIsEditingBank(true)}
                    >
                      <Edit3 size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.editFullButtonText}>Edit Bank Details</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* EDIT MODE */
                <View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Account Holder Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={bankForm.accountHolderName}
                      onChangeText={(val) => setBankForm({ ...bankForm, accountHolderName: val })}
                      placeholder="e.g. John Doe"
                      editable={savingSection !== 'bank'}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bank Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={bankForm.bankName}
                      onChangeText={(val) => setBankForm({ ...bankForm, bankName: val })}
                      placeholder="e.g. HDFC Bank"
                      editable={savingSection !== 'bank'}
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
                      editable={savingSection !== 'bank'}
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
                      editable={savingSection !== 'bank'}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>IFSC Code *</Text>
                    <TextInput
                      style={[styles.input, { textTransform: 'uppercase' }]}
                      value={bankForm.ifscCode}
                      onChangeText={(val) => setBankForm({ ...bankForm, ifscCode: val })}
                      placeholder="e.g. HDFC0001234"
                      editable={savingSection !== 'bank'}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Settlement UPI ID (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={bankForm.upiId}
                      onChangeText={(val) => setBankForm({ ...bankForm, upiId: val })}
                      placeholder="e.g. yourname@upi"
                      editable={savingSection !== 'bank'}
                    />
                  </View>
                  
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {isBankComplete && (
                      <TouchableOpacity
                        style={styles.cancelEditBtn}
                        onPress={() => {
                          if (fullMerchant?.bankDetails) {
                            setBankForm({
                              accountHolderName: fullMerchant.bankDetails.accountHolderName || '',
                              accountNumber: fullMerchant.bankDetails.accountNumber || '',
                              confirmAccountNumber: fullMerchant.bankDetails.accountNumber || '',
                              ifscCode: fullMerchant.bankDetails.ifscCode || '',
                              bankName: fullMerchant.bankDetails.bankName || '',
                              upiId: fullMerchant.bankDetails.upiId || '',
                            });
                          }
                          setIsEditingBank(false);
                        }}
                        disabled={savingSection === 'bank'}
                      >
                        <Text style={styles.cancelEditBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={saveBankDetails}
                      disabled={savingSection === 'bank'}
                      style={[styles.primaryButton, isBankComplete && { flex: 1, marginTop: 0 }]}
                    >
                      {savingSection === 'bank' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Save Bank Details</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {activeTab === 'kyc' && (() => {
            const panData = fullMerchant?.kyc?.pan;
            const panStatus = getDocumentStatus(panData, 'pan');

            const bpData = fullMerchant?.kyc?.businessProof;
            const bpStatus = getDocumentStatus(bpData, 'business');

            const gstData = fullMerchant?.kyc?.gst;
            const gstStatus = getDocumentStatus(gstData, 'gst');

            const bankProofData = fullMerchant?.kyc?.bankProof;
            const bankProofStatus = getDocumentStatus(bankProofData, 'bank');

            const hasEditableDocs = [panStatus, bpStatus, gstStatus, bankProofStatus].some(
              (s) => s === 'not_submitted' || s === 'rejected'
            );

            const allVerified = [panStatus, bpStatus, bankProofStatus].every((s) => s === 'verified');
            const allUnderReviewOrVerified = [panStatus, bpStatus, gstStatus, bankProofStatus].every(
              (s) => s === 'verified' || s === 'under_review'
            );

            return (
              <View style={styles.formCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formCardTitle}>Statutory & KYC Compliance</Text>
                    <Text style={styles.formDescription}>
                      Official business identity and registration proofs verified by FlashFits compliance.
                    </Text>
                  </View>
                </View>

                {/* 1. PAN CARD IDENTITY */}
                <View style={styles.docCard}>
                  <View style={styles.docCardHeader}>
                    <View style={styles.docTitleRow}>
                      <Shield size={16} color="#0F172A" />
                      <Text style={styles.docTitle}>PAN Card Identity *</Text>
                    </View>
                    {renderDocBadge(panStatus)}
                  </View>
                  <Text style={styles.docSub}>Permanent Account Number of Business / Proprietor</Text>

                  {panStatus === 'verified' && (
                    <View style={styles.verifiedCardInfo}>
                      <Text style={styles.docValueBig}>{panData?.number}</Text>
                      <View style={styles.infoTextRow}>
                        <Lock size={12} color="#059669" />
                        <Text style={styles.lockNoticeText}>Verified & Locked • Cannot be edited</Text>
                      </View>
                    </View>
                  )}

                  {panStatus === 'under_review' && (
                    <View style={styles.reviewCardInfo}>
                      <Text style={styles.docValueBig}>{panData?.number || 'PAN Document on File'}</Text>
                      <View style={styles.infoTextRow}>
                        <Clock size={12} color="#B45309" />
                        <Text style={styles.reviewNoticeText}>Submitted • Under Admin audit (Locked)</Text>
                      </View>
                    </View>
                  )}

                  {(panStatus === 'rejected' || panStatus === 'not_submitted') && (
                    <View>
                      {panStatus === 'rejected' && (
                        <View style={styles.rejectedCardInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertCircle size={14} color="#DC2626" />
                            <Text style={styles.rejectedNoticeTitle}>Action Required</Text>
                          </View>
                          <Text style={styles.rejectedNoticeText}>
                            {fullMerchant?.rejectionReason || 'PAN document flagged by admin. Please upload a clear replacement.'}
                          </Text>
                        </View>
                      )}
                      <TextInput
                        style={[styles.input, { textTransform: 'uppercase' }]}
                        value={kycForm.panNumber}
                        onChangeText={(val) => setKycForm({ ...kycForm, panNumber: val })}
                        placeholder="Enter 10-character PAN (e.g. ABCDE1234F)"
                        maxLength={10}
                        editable={savingSection !== 'kyc'}
                      />
                      <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => pickImage('panImageUri')}
                        disabled={savingSection === 'kyc'}
                      >
                        <Upload size={18} color="#3B82F6" />
                        <Text style={styles.uploadButtonText}>
                          {kycForm.panImageUri ? 'Change PAN Card Image' : 'Upload PAN Card Photo'}
                        </Text>
                      </TouchableOpacity>
                      {kycForm.panImageUri && <Text style={styles.successText}>✓ New PAN image selected</Text>}
                    </View>
                  )}
                </View>

                {/* 2. LEGAL BUSINESS PROOF */}
                <View style={styles.docCard}>
                  <View style={styles.docCardHeader}>
                    <View style={styles.docTitleRow}>
                      <FileText size={16} color="#0F172A" />
                      <Text style={styles.docTitle}>Legal Business Proof</Text>
                    </View>
                    {renderDocBadge(bpStatus)}
                  </View>
                  <Text style={styles.docSub}>Shop License, Udyam MSME, or Rent Agreement</Text>

                  {bpStatus === 'verified' && (
                    <View style={styles.verifiedCardInfo}>
                      <Text style={styles.docValueBig}>
                        {PROOF_TYPES.find((p) => p.id === bpData?.proofType)?.label || 'Business Proof Verified'}
                      </Text>
                      <View style={styles.infoTextRow}>
                        <Lock size={12} color="#059669" />
                        <Text style={styles.lockNoticeText}>Verified Business Document • Locked</Text>
                      </View>
                    </View>
                  )}

                  {bpStatus === 'under_review' && (
                    <View style={styles.reviewCardInfo}>
                      <Text style={styles.docValueBig}>
                        {PROOF_TYPES.find((p) => p.id === bpData?.proofType)?.label || 'Proof Document on File'}
                      </Text>
                      <View style={styles.infoTextRow}>
                        <Clock size={12} color="#B45309" />
                        <Text style={styles.reviewNoticeText}>Submitted • Under Admin audit (Locked)</Text>
                      </View>
                    </View>
                  )}

                  {(bpStatus === 'rejected' || bpStatus === 'not_submitted') && (
                    <View>
                      {bpStatus === 'rejected' && (
                        <View style={styles.rejectedCardInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertCircle size={14} color="#DC2626" />
                            <Text style={styles.rejectedNoticeTitle}>Action Required</Text>
                          </View>
                          <Text style={styles.rejectedNoticeText}>
                            {fullMerchant?.rejectionReason || 'Business proof flagged. Please select type and upload a valid proof.'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.label, { marginTop: 4 }]}>Select Proof Type</Text>
                      <View style={styles.radioGroup}>
                        {PROOF_TYPES.map((pt) => (
                          <TouchableOpacity
                            key={pt.id}
                            style={[styles.radioItem, kycForm.businessProofType === pt.id && styles.radioItemActive]}
                            onPress={() => setKycForm({ ...kycForm, businessProofType: pt.id })}
                            disabled={savingSection === 'kyc'}
                          >
                            <Text style={[styles.radioText, kycForm.businessProofType === pt.id && styles.radioTextActive]}>
                              {pt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => pickImage('businessProofImageUri')}
                        disabled={savingSection === 'kyc'}
                      >
                        <Upload size={18} color="#3B82F6" />
                        <Text style={styles.uploadButtonText}>
                          {kycForm.businessProofImageUri ? 'Change Proof Document Image' : 'Upload Proof Document Image'}
                        </Text>
                      </TouchableOpacity>
                      {kycForm.businessProofImageUri && <Text style={styles.successText}>✓ New proof image selected</Text>}
                    </View>
                  )}
                </View>

                {/* 3. GST CERTIFICATE */}
                <View style={styles.docCard}>
                  <View style={styles.docCardHeader}>
                    <View style={styles.docTitleRow}>
                      <Shield size={16} color="#0F172A" />
                      <Text style={styles.docTitle}>GST Certificate (Optional)</Text>
                    </View>
                    {renderDocBadge(gstStatus)}
                  </View>
                  <Text style={styles.docSub}>GSTIN Certificate for commercial invoicing</Text>

                  {gstStatus === 'verified' && (
                    <View style={styles.verifiedCardInfo}>
                      <Text style={styles.docValueBig}>GSTIN: {gstData?.number || 'Verified'}</Text>
                      <View style={styles.infoTextRow}>
                        <Lock size={12} color="#059669" />
                        <Text style={styles.lockNoticeText}>Verified GST Certificate • Locked</Text>
                      </View>
                    </View>
                  )}

                  {gstStatus === 'under_review' && (
                    <View style={styles.reviewCardInfo}>
                      <Text style={styles.docValueBig}>GSTIN: {gstData?.number || 'Certificate on File'}</Text>
                      <View style={styles.infoTextRow}>
                        <Clock size={12} color="#B45309" />
                        <Text style={styles.reviewNoticeText}>Submitted • Under Admin audit (Locked)</Text>
                      </View>
                    </View>
                  )}

                  {(gstStatus === 'rejected' || gstStatus === 'not_submitted') && (
                    <View>
                      {gstStatus === 'rejected' && (
                        <View style={styles.rejectedCardInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertCircle size={14} color="#DC2626" />
                            <Text style={styles.rejectedNoticeTitle}>Action Required</Text>
                          </View>
                          <Text style={styles.rejectedNoticeText}>
                            {fullMerchant?.rejectionReason || 'GST certificate issue flagged by admin.'}
                          </Text>
                        </View>
                      )}
                      <TextInput
                        style={[styles.input, { textTransform: 'uppercase' }]}
                        value={kycForm.gstNumber}
                        onChangeText={(val) => setKycForm({ ...kycForm, gstNumber: val })}
                        placeholder="GST Number (15 characters)"
                        maxLength={15}
                        editable={savingSection !== 'kyc'}
                      />
                      <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => pickImage('gstImageUri')}
                        disabled={savingSection === 'kyc'}
                      >
                        <Upload size={18} color="#3B82F6" />
                        <Text style={styles.uploadButtonText}>
                          {kycForm.gstImageUri ? 'Change GST Certificate Image' : 'Upload GST Certificate Image'}
                        </Text>
                      </TouchableOpacity>
                      {kycForm.gstImageUri && <Text style={styles.successText}>✓ New GST image selected</Text>}
                    </View>
                  )}
                </View>

                {/* 4. SETTLEMENT BANK PROOF */}
                <View style={styles.docCard}>
                  <View style={styles.docCardHeader}>
                    <View style={styles.docTitleRow}>
                      <CreditCard size={16} color="#0F172A" />
                      <Text style={styles.docTitle}>Bank Proof (Cancelled Cheque / Passbook)</Text>
                    </View>
                    {renderDocBadge(bankProofStatus)}
                  </View>
                  <Text style={styles.docSub}>Validates ownership of registered payout account</Text>

                  {bankProofStatus === 'verified' && (
                    <View style={styles.verifiedCardInfo}>
                      <Text style={styles.docValueBig}>Bank Proof Verified on File</Text>
                      <View style={styles.infoTextRow}>
                        <Lock size={12} color="#059669" />
                        <Text style={styles.lockNoticeText}>Verified Bank Proof • Linked to settlement account</Text>
                      </View>
                    </View>
                  )}

                  {bankProofStatus === 'under_review' && (
                    <View style={styles.reviewCardInfo}>
                      <Text style={styles.docValueBig}>Bank Proof Submitted on File</Text>
                      <View style={styles.infoTextRow}>
                        <Clock size={12} color="#B45309" />
                        <Text style={styles.reviewNoticeText}>Submitted • Under Admin audit (Locked)</Text>
                      </View>
                    </View>
                  )}

                  {(bankProofStatus === 'rejected' || bankProofStatus === 'not_submitted') && (
                    <View>
                      {bankProofStatus === 'rejected' && (
                        <View style={styles.rejectedCardInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertCircle size={14} color="#DC2626" />
                            <Text style={styles.rejectedNoticeTitle}>Action Required</Text>
                          </View>
                          <Text style={styles.rejectedNoticeText}>
                            {fullMerchant?.rejectionReason || 'Bank proof image blurry or account details mismatch.'}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => pickImage('bankProofImageUri')}
                        disabled={savingSection === 'kyc'}
                      >
                        <Upload size={18} color="#3B82F6" />
                        <Text style={styles.uploadButtonText}>
                          {kycForm.bankProofImageUri ? 'Change Cancelled Cheque / Passbook' : 'Upload Cancelled Cheque or Passbook Photo'}
                        </Text>
                      </TouchableOpacity>
                      {kycForm.bankProofImageUri && <Text style={styles.successText}>✓ New bank proof image selected</Text>}
                    </View>
                  )}
                </View>

                {/* BOTTOM ACTION / STATUS BANNER */}
                {hasEditableDocs ? (
                  <TouchableOpacity
                    onPress={saveKycDetails}
                    disabled={savingSection === 'kyc'}
                    style={[styles.primaryButton, { marginTop: 12 }]}
                  >
                    {savingSection === 'kyc' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Submit Documents for Audit</Text>
                    )}
                  </TouchableOpacity>
                ) : allVerified ? (
                  <View style={styles.allCompliantCard}>
                    <CheckCircle size={20} color="#10B981" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.allCompliantTitle}>All Statutory Documents Verified</Text>
                      <Text style={styles.allCompliantDesc}>
                        Your business profile is fully verified and compliant with FlashFits platform standards.
                      </Text>
                    </View>
                  </View>
                ) : allUnderReviewOrVerified ? (
                  <View style={styles.allUnderReviewCard}>
                    <Clock size={20} color="#D97706" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.allUnderReviewTitle}>Documents Under Audit</Text>
                      <Text style={styles.allUnderReviewDesc}>
                        All submitted documents are currently locked and being audited by FlashFits compliance. You will be notified once reviewed.
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })()}
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  bankStatusCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  bankIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankCardBankName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  bankCardHolderName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  viewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  viewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  editFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    height: 48,
    marginTop: 8,
  },
  editFullButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  contactSupportCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  contactSupportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  contactSupportDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 14,
  },
  contactSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
    height: 42,
  },
  contactSupportBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelEditBtn: {
    paddingHorizontal: 20,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelEditBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
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
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  docCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  docSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  verifiedCardInfo: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
  },
  reviewCardInfo: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
  },
  rejectedCardInfo: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  lockNoticeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  reviewNoticeText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  rejectedNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  rejectedNoticeText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontWeight: '500',
  },
  docValueBig: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  rejectedBadge: {
    backgroundColor: '#FEE2E2',
  },
  rejectedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  notProvidedBadge: {
    backgroundColor: '#F1F5F9',
  },
  notProvidedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  allCompliantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  allCompliantTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  allCompliantDesc: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
    lineHeight: 17,
  },
  allUnderReviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  allUnderReviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  allUnderReviewDesc: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 17,
  },
});
