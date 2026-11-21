import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Linking,
  Dimensions,
} from 'react-native';
import { ArrowUpCircle, CheckCircle, Download, X } from 'lucide-react-native';
import { AppUpdateType } from '@/utils/versionCompare';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEFAULT_MERCHANT_DOWNLOAD_URL = 'https://github.com/shubh4mb/MerchantApp/releases/latest/download/merchant.apk';

export interface AppUpdateModalProps {
  visible: boolean;
  type: AppUpdateType;
  currentVersion: string;
  latestVersion: string;
  storeUrl?: string;
  webUrl?: string;
  title?: string;
  message?: string;
  releaseNotes?: string[];
  onDismiss?: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  visible,
  type,
  currentVersion,
  latestVersion,
  storeUrl,
  webUrl,
  title,
  message,
  releaseNotes = [],
  onDismiss,
}) => {
  const isMandatory = type === 'MANDATORY';

  const effectiveDownloadUrl = webUrl || storeUrl || DEFAULT_MERCHANT_DOWNLOAD_URL;

  // Android Hardware Back Button trap for Mandatory updates
  useEffect(() => {
    if (!visible) return;

    const onBackPress = () => {
      if (isMandatory) {
        return true; // Block hardware back button
      }
      if (onDismiss) {
        onDismiss();
        return true;
      }
      return false;
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => backSubscription.remove();
  }, [visible, isMandatory, onDismiss]);

  const handleUpdatePress = async () => {
    try {
      const supported = await Linking.canOpenURL(effectiveDownloadUrl);
      if (supported) {
        await Linking.openURL(effectiveDownloadUrl);
      } else {
        await Linking.openURL(DEFAULT_MERCHANT_DOWNLOAD_URL);
      }
    } catch {
      await Linking.openURL(DEFAULT_MERCHANT_DOWNLOAD_URL);
    }
  };

  if (!visible) return null;

  const displayTitle =
    title ||
    (isMandatory
      ? 'Update Required'
      : 'New Version Available');

  const displayMessage =
    message ||
    (isMandatory
      ? 'Please update FlashFits Merchant to the latest version to continue accepting orders and managing your store.'
      : 'A new version with performance improvements and bug fixes is ready to download.');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isMandatory && onDismiss) {
          onDismiss();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Close button for optional updates */}
          {!isMandatory && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onDismiss}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          )}

          {/* Header Icon */}
          <View style={[styles.iconContainer, isMandatory ? styles.iconMandatory : styles.iconOptional]}>
            <ArrowUpCircle size={36} color={isMandatory ? '#EF4444' : '#10B981'} />
          </View>

          {/* Badge */}
          <View style={[styles.badge, isMandatory ? styles.badgeMandatory : styles.badgeOptional]}>
            <Text style={[styles.badgeText, isMandatory ? styles.badgeTextMandatory : styles.badgeTextOptional]}>
              {isMandatory ? 'MANDATORY UPDATE' : 'RECOMMENDED UPDATE'}
            </Text>
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.message}>{displayMessage}</Text>

          {/* Version Pills */}
          <View style={styles.versionRow}>
            <View style={styles.versionPill}>
              <Text style={styles.versionPillLabel}>CURRENT</Text>
              <Text style={styles.versionPillValue}>v{currentVersion}</Text>
            </View>
            <Text style={styles.versionArrow}>→</Text>
            <View style={[styles.versionPill, styles.versionPillTarget]}>
              <Text style={styles.versionPillLabel}>LATEST</Text>
              <Text style={[styles.versionPillValue, styles.versionPillValueHighlight]}>v{latestVersion}</Text>
            </View>
          </View>

          {/* Release Notes */}
          {releaseNotes && releaseNotes.length > 0 && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>What's New:</Text>
              {releaseNotes.map((note, index) => (
                <View key={index} style={styles.noteItem}>
                  <CheckCircle size={14} color="#10B981" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdatePress}
              activeOpacity={0.85}
            >
              <Download size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.updateButtonText}>
                {isMandatory ? 'Download & Install' : 'Update Now'}
              </Text>
            </TouchableOpacity>

            {!isMandatory && onDismiss && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.laterButtonText}>Remind Me Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 40, 380),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    padding: 4,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconMandatory: {
    backgroundColor: '#FEE2E2',
  },
  iconOptional: {
    backgroundColor: '#D1FAE5',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeMandatory: {
    backgroundColor: '#FEE2E2',
  },
  badgeOptional: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  badgeTextMandatory: {
    color: '#EF4444',
  },
  badgeTextOptional: {
    color: '#16A34A',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  versionPill: {
    alignItems: 'center',
  },
  versionPillTarget: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  versionPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  versionPillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  versionPillValueHighlight: {
    color: '#2563EB',
  },
  versionArrow: {
    marginHorizontal: 14,
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
    lineHeight: 17,
  },
  buttonContainer: {
    width: '100%',
    gap: 8,
  },
  updateButton: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  laterButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});

