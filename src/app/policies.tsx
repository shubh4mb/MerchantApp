import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  FileText,
  RefreshCw,
  CreditCard,
  PackageCheck,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react-native';

type PolicyTab = 'agreement' | 'returns' | 'settlements' | 'packaging' | 'privacy';

export default function MerchantPoliciesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = (params?.tab as PolicyTab) || 'agreement';
  const [activeTab, setActiveTab] = useState<PolicyTab>(initialTab);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={22} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Merchant Policies & Terms</Text>
          <Text style={styles.headerSubtitle}>FlashFits Partner Operating Standards</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Horizontal Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'agreement' && styles.tabButtonActive]}
            onPress={() => setActiveTab('agreement')}
          >
            <FileText
              size={15}
              color={activeTab === 'agreement' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'agreement' && styles.tabButtonTextActive,
              ]}
            >
              Partner Terms
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'returns' && styles.tabButtonActive]}
            onPress={() => setActiveTab('returns')}
          >
            <RefreshCw
              size={15}
              color={activeTab === 'returns' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'returns' && styles.tabButtonTextActive,
              ]}
            >
              Try & Buy & Returns
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'settlements' && styles.tabButtonActive]}
            onPress={() => setActiveTab('settlements')}
          >
            <CreditCard
              size={15}
              color={activeTab === 'settlements' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'settlements' && styles.tabButtonTextActive,
              ]}
            >
              Payouts & Fees
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'packaging' && styles.tabButtonActive]}
            onPress={() => setActiveTab('packaging')}
          >
            <PackageCheck
              size={15}
              color={activeTab === 'packaging' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'packaging' && styles.tabButtonTextActive,
              ]}
            >
              Packaging & Seals
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'privacy' && styles.tabButtonActive]}
            onPress={() => setActiveTab('privacy')}
          >
            <ShieldCheck
              size={15}
              color={activeTab === 'privacy' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'privacy' && styles.tabButtonTextActive,
              ]}
            >
              Data & Privacy
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Body Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Version Badge */}
        <View style={styles.badgeBanner}>
          <AlertCircle size={18} color="#2563EB" />
          <Text style={styles.badgeText}>
            Effective Date: September 2026 • Official Merchant Partner Agreement & Operating Guidelines
          </Text>
        </View>

        {/* TAB 1: Partner Terms & Agreement */}
        {activeTab === 'agreement' && (
          <View style={styles.policyCard}>
            <Text style={styles.cardHeader}>1. Scope of Merchant Agreement</Text>
            <Text style={styles.paragraph}>
              This agreement constitutes a binding legal contract between FlashFits Quick Commerce Private
              Limited ("FlashFits") and the onboarded store owner/merchant entity ("Merchant"). By listing
              products on FlashFits or accepting orders through the Merchant App, you agree to comply with
              all operating SLAs, quality standards, and platform policies herein.
            </Text>

            <Text style={styles.cardHeader}>2. Store Verification & KYC Compliance</Text>
            <Text style={styles.paragraph}>
              Merchants must provide accurate and verifiable business records during onboarding:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Permanent Account Number (PAN) of proprietor or enterprise.</Text>
              <Text style={styles.bulletItem}>• Goods and Services Tax Identification Number (GSTIN) where applicable.</Text>
              <Text style={styles.bulletItem}>• Bank account in the exact registered commercial trade name for settlements.</Text>
              <Text style={styles.bulletItem}>• Physical boutique/store location verified with exact geo-coordinates.</Text>
            </View>

            <Text style={styles.cardHeader}>3. Product Catalog & 100% Authenticity Guarantee</Text>
            <Text style={styles.paragraph}>
              All apparel, footwear, and lifestyle merchandise listed must be:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>100% Genuine & Authentic:</Text> Counterfeits, first copies, and unauthorized replicas are strictly prohibited. Verified counterfeit listings incur a ₹50,000 penalty and instant store blacklisting.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Brand New & Tagged:</Text> Items must be unworn, unwashed, and factory-fresh with original brand tags and MRP labels attached.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Price Parity:</Text> Listing price on FlashFits cannot exceed the offline in-store retail price.
              </Text>
            </View>

            <Text style={styles.cardHeader}>4. Order Acceptance & Packing SLAs</Text>
            <Text style={styles.paragraph}>
              To guarantee instant quick-commerce delivery to customers:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Order Acceptance:</Text> Merchants must accept or reject incoming order alerts within 5 minutes.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Order Packing:</Text> Accepted orders must be picked from shelves, neatly folded, and packed in sealed FlashFits Zip Covers within 10 minutes.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Rider Handshake:</Text> Verify the rider's Order ID last 4 digits (#XXXX) before providing the 4-digit pickup OTP.
              </Text>
            </View>

            <Text style={styles.cardHeader}>5. Store Operating Hours & Auto-Offline</Text>
            <Text style={styles.paragraph}>
              Merchants must maintain regular store operational hours as declared in the profile. If a store
              misses 3 consecutive order alerts or experiences inventory stockouts, the system will
              temporarily switch the store status to Offline to prevent customer cancellations.
            </Text>
          </View>
        )}

        {/* TAB 2: Try & Buy, Returns & Damage Policy */}
        {activeTab === 'returns' && (
          <View style={styles.policyCard}>
            <Text style={styles.cardHeader}>1. The Try & Buy Doorstep Model</Text>
            <Text style={styles.paragraph}>
              FlashFits enables customers to order garments with ₹0 upfront payment for a 15–30 minute
              doorstep fitting trial session. The customer may keep all, some, or none of the ordered items.
              Unkept items are returned back to your store by the same dedicated FlashFits delivery rider.
            </Text>

            <Text style={styles.cardHeader}>2. In-Person Return Handshake & Inspection</Text>
            <Text style={styles.paragraph}>
              When the rider arrives back at your store with unkept trial items:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Immediate Inspection:</Text> Inspect the returned garments in the rider's presence before confirming the return handshake.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Return Acceptance Criteria:</Text> All original tags must be attached, garments must be clean, odorless, free of makeup or perfume stains, and show no physical tears or snags.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Completion OTP:</Text> Share the return completion OTP with the rider once items are physically verified.
              </Text>
            </View>

            <Text style={styles.cardHeader}>3. Damage Reporting & Claim Window (24 Hours)</Text>
            <Text style={styles.paragraph}>
              In the rare event that an item is returned damaged, stained, or missing tags:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>24-Hour Notice:</Text> Submit a Damage Incident Report via the Merchant App within 24 hours of the return.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Photo & Video Proof:</Text> Upload clear, well-lit photos showing the garment defect, security barcode tag, and product barcode.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>Merchant Protection Fund (MPF):</Text> If verified by our dispute panel as customer-caused or transit damage, FlashFits reimburses the merchant's wholesale cost price within 3 business days.
              </Text>
            </View>

            <Text style={styles.cardHeader}>4. Courier Delivery Returns (Standard 3-Day Window)</Text>
            <Text style={styles.paragraph}>
              For long-distance courier orders, customers have a 3-calendar-day (72-hour) return window for
              verified defects or sizing issues. Merchant has 48 hours from return receipt to inspect the
              courier parcel before refund approval.
            </Text>
          </View>
        )}

        {/* TAB 3: Settlements, Commissions & Payouts */}
        {activeTab === 'settlements' && (
          <View style={styles.policyCard}>
            <Text style={styles.cardHeader}>1. Commission Structure</Text>
            <Text style={styles.paragraph}>
              FlashFits charges a commission only on <Text style={styles.bold}>Net Kept Sales</Text> (items
              purchased and retained by the customer). Zero commission is charged on items returned during
              the Try & Buy trial session or orders cancelled prior to delivery.
            </Text>

            <Text style={styles.cardHeader}>2. Settlement Cycle (T+2 Days)</Text>
            <Text style={styles.paragraph}>
              All completed orders are settled on a rolling <Text style={styles.bold}>T+2 business days</Text> cycle.
              Payouts are transferred directly via automated NEFT/IMPS to the merchant's verified bank
              account. A detailed settlement statement with individual order breakdowns is available in the
              Revenue tab.
            </Text>

            <Text style={styles.cardHeader}>3. Tax Compliance & Deductions</Text>
            <Text style={styles.paragraph}>
              In compliance with statutory Indian Tax Regulations:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>TCS (Tax Collected at Source):</Text> 1% TCS is deducted under Section 52 of the CGST/SGST Act for registered sellers.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>TDS (Tax Deducted at Source):</Text> 1% TDS under Section 194-O of the Income Tax Act where applicable.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.bold}>GST Invoices:</Text> FlashFits issues a monthly GST-compliant invoice for platform services and marketing fees.
              </Text>
            </View>

            <Text style={styles.cardHeader}>4. Return Adjustments</Text>
            <Text style={styles.paragraph}>
              Any approved courier returns or disputed chargebacks are adjusted against the merchant's
              subsequent settlement cycle.
            </Text>
          </View>
        )}

        {/* TAB 4: Packaging & Zip Covers */}
        {activeTab === 'packaging' && (
          <View style={styles.policyCard}>
            <Text style={styles.cardHeader}>1. FlashFits Tamper-Evident Zip Covers</Text>
            <Text style={styles.paragraph}>
              To preserve garment quality and brand reputation, all Try & Buy orders MUST be dispatched
              inside authentic FlashFits Zip Covers. Standard polybags or unbranded bags are not permitted.
            </Text>

            <Text style={styles.cardHeader}>2. Security Barcode Seals</Text>
            <Text style={styles.paragraph}>
              Every Zip Cover package must be closed with a serialized FlashFits Security Barcode Tag:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Scan the seal tag ID in the Merchant App prior to handoff.</Text>
              <Text style={styles.bulletItem}>• The delivery rider verifies the intact seal before departure.</Text>
              <Text style={styles.bulletItem}>• The customer verifies the seal before initiating trial.</Text>
              <Text style={styles.bulletItem}>• Broken seals without customer presence must be rejected immediately.</Text>
            </View>

            <Text style={styles.cardHeader}>3. Packaging Standards & Hygiene</Text>
            <Text style={styles.paragraph}>
              • Garments must be neatly folded and free from dust, store odors, or humidity.
              {'\n'}• Garment hangers must be durable and secured within the garment sleeve.
              {'\n'}• Footwear must be in original boxes with inner tissue paper intact.
            </Text>

            <Text style={styles.cardHeader}>4. Ordering Zip Cover Restocks</Text>
            <Text style={styles.paragraph}>
              Merchants can order additional branded zip covers and security barcode tags directly from
              the Merchant App in the "Order Zip Covers" section at subsidized cost.
            </Text>
          </View>
        )}

        {/* TAB 5: Data Protection & Customer Privacy */}
        {activeTab === 'privacy' && (
          <View style={styles.policyCard}>
            <Text style={styles.cardHeader}>1. Customer Data Confidentiality</Text>
            <Text style={styles.paragraph}>
              Customer names, phone numbers, and delivery addresses provided via FlashFits are confidential
              and shared strictly for order fulfillment. Merchants must comply with the Digital Personal
              Data Protection (DPDP) Act.
            </Text>

            <Text style={styles.cardHeader}>2. Strict Non-Solicitation Policy</Text>
            <Text style={styles.paragraph}>
              Merchants are strictly prohibited from:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Contacting customers directly via WhatsApp, SMS, or phone for off-platform sales.</Text>
              <Text style={styles.bulletItem}>• Inserting external store discount flyers, coupons, or direct marketing cards inside parcels.</Text>
              <Text style={styles.bulletItem}>• Selling or sharing customer information with third-party advertisers.</Text>
            </View>

            <Text style={styles.cardHeader}>3. Penalties for Breach</Text>
            <Text style={styles.paragraph}>
              Direct customer solicitation or misuse of customer contact data is considered a severe
              contractual breach resulting in immediate platform termination and forfeiture of pending
              merchant balances.
            </Text>
          </View>
        )}

        {/* Support Help Card */}
        <View style={styles.supportCard}>
          <HelpCircle size={24} color="#2563EB" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>Need Help or Policy Clarification?</Text>
            <Text style={styles.supportText}>
              Our Merchant Partner Success Team is available 7 days a week at
              merchants@flashfits.com or via in-app partner chat.
            </Text>
          </View>
        </View>

        <View style={styles.footerSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: '#0F172A',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
  },
  badgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  badgeText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
    lineHeight: 16,
  },
  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  bulletList: {
    paddingLeft: 6,
    marginBottom: 10,
    gap: 6,
  },
  bulletItem: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginTop: 8,
  },
  supportContent: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  supportText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  footerSpacing: {
    height: 30,
  },
});
