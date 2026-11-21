import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import api from '@/utils/api';
import { AppUpdateType, getUpdateStatus } from '@/utils/versionCompare';

const DISMISSED_VERSION_KEY = 'flashfits_merchant_dismissed_update_version';
const DISMISSED_TIME_KEY = 'flashfits_merchant_dismissed_update_time';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours snooze for optional updates

export interface VersionPolicy {
  minVersion: string;
  latestVersion: string;
  minVersionAndroid?: string;
  latestVersionAndroid?: string;
  minVersionIos?: string;
  latestVersionIos?: string;
  storeUrl?: string;
  webUrl?: string;
  mandatoryTitle?: string;
  mandatoryMessage?: string;
  optionalTitle?: string;
  optionalMessage?: string;
  releaseNotes?: string[];
}

export function useAppUpdate() {
  const [updateType, setUpdateType] = useState<AppUpdateType>('UP_TO_DATE');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [versionPolicy, setVersionPolicy] = useState<VersionPolicy | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const currentAppVersion = Constants.expoConfig?.version || '1.0.0';

  const checkVersion = useCallback(async () => {
    try {
      setIsChecking(true);
      const res = await api.get('/user/app-version', {
        params: { app: 'merchant', platform: Platform.OS },
      });

      const policy: VersionPolicy = res.data;
      if (!policy || !policy.minVersion || !policy.latestVersion) {
        return;
      }

      setVersionPolicy(policy);

      const targetMinVersion = Platform.OS === 'android'
        ? (policy.minVersionAndroid || policy.minVersion)
        : (policy.minVersionIos || policy.minVersion);

      const targetLatestVersion = Platform.OS === 'android'
        ? (policy.latestVersionAndroid || policy.latestVersion)
        : (policy.latestVersionIos || policy.latestVersion);

      const status = getUpdateStatus(
        currentAppVersion,
        targetMinVersion,
        targetLatestVersion
      );

      if (status === 'MANDATORY') {
        setUpdateType('MANDATORY');
        setIsModalVisible(true);
      } else if (status === 'OPTIONAL') {
        setUpdateType('OPTIONAL');

        const [dismissedVersion, dismissedTimeStr] = await Promise.all([
          SecureStore.getItemAsync(DISMISSED_VERSION_KEY),
          SecureStore.getItemAsync(DISMISSED_TIME_KEY),
        ]);

        const dismissedTime = dismissedTimeStr ? parseInt(dismissedTimeStr, 10) : 0;
        const isSnoozed =
          dismissedVersion === policy.latestVersion &&
          Date.now() - dismissedTime < SNOOZE_DURATION_MS;

        if (!isSnoozed) {
          setIsModalVisible(true);
        } else {
          setIsModalVisible(false);
        }
      } else {
        setUpdateType('UP_TO_DATE');
        setIsModalVisible(false);
      }
    } catch (err) {
      console.warn('[useAppUpdate] Could not fetch version policy:', err);
    } finally {
      setIsChecking(false);
    }
  }, [currentAppVersion]);

  const dismissOptionalUpdate = useCallback(async () => {
    if (updateType === 'MANDATORY') return;
    try {
      if (versionPolicy?.latestVersion) {
        await Promise.all([
          SecureStore.setItemAsync(DISMISSED_VERSION_KEY, versionPolicy.latestVersion),
          SecureStore.setItemAsync(DISMISSED_TIME_KEY, Date.now().toString()),
        ]);
      }
    } catch (e) {
      console.warn('[useAppUpdate] Error storing snooze state:', e);
    }
    setIsModalVisible(false);
  }, [updateType, versionPolicy]);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  return {
    updateType,
    isModalVisible,
    versionPolicy,
    currentAppVersion,
    isChecking,
    checkVersion,
    dismissOptionalUpdate,
  };
}

