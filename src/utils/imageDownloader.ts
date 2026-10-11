import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export interface DownloadResult {
  success: boolean;
  message?: string;
}

/**
 * Downloads a single remote image and saves it to the user's photo gallery / device.
 */
export async function downloadAndSaveImage(
  url: string,
  filename: string = 'product_image.jpg'
): Promise<boolean> {
  if (!url) {
    Alert.alert('Error', 'No image URL provided.');
    return false;
  }

  // Web fallback
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      return true;
    } catch {
      window.open(url, '_blank');
      return true;
    }
  }

  try {
    let cleanExt = 'jpg';
    const splitExt = url.split('.').pop()?.split('?')[0]?.toLowerCase();
    if (splitExt && ['jpg', 'jpeg', 'png', 'webp'].includes(splitExt)) {
      cleanExt = splitExt;
    }
    const safeBase = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const actualFilename = `${safeBase}.${cleanExt}`;

    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) {
      throw new Error('Storage directory unavailable');
    }
    const separator = cacheDir.endsWith('/') ? '' : '/';
    const localUri = `${cacheDir}${separator}${Date.now()}_${actualFilename}`;

    const downloadRes = await FileSystem.downloadAsync(url, localUri);
    if (downloadRes.status !== 200) {
      throw new Error(`Download failed with status ${downloadRes.status}`);
    }

    // Try saving directly to Media Library (Gallery)
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (permission.granted) {
      await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
      return true;
    }

    // Fallback to native sharing sheet (Save to Files / Photo / etc.)
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(downloadRes.uri, {
        dialogTitle: 'Save Product Image',
        mimeType: cleanExt === 'png' ? 'image/png' : 'image/jpeg',
      });
      return true;
    } else {
      Alert.alert(
        'Permission Denied',
        'Storage/Photos permission is needed to save the image directly to your gallery.'
      );
      return false;
    }
  } catch (error: any) {
    console.error('Error saving image:', error);
    Alert.alert('Download Error', error?.message || 'Could not download the image.');
    return false;
  }
}

/**
 * Downloads multiple images in sequence and saves them to the gallery.
 */
export async function downloadAndSaveMultipleImages(
  urls: string[],
  baseName: string = 'product',
  onProgress?: (current: number, total: number) => void
): Promise<{ successCount: number; total: number }> {
  const validUrls = urls.filter(Boolean);
  if (validUrls.length === 0) {
    Alert.alert('Notice', 'No images found to download.');
    return { successCount: 0, total: 0 };
  }

  // If on native, request permissions once up front
  if (Platform.OS !== 'web') {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow Photo Library access in your phone settings to save multiple product images to your gallery.'
      );
    }
  }

  let successCount = 0;
  for (let i = 0; i < validUrls.length; i++) {
    onProgress?.(i + 1, validUrls.length);
    const filename = `${baseName}_${i + 1}.jpg`;
    const success = await downloadAndSaveImage(validUrls[i], filename);
    if (success) successCount++;
    // Small delay between saves
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return { successCount, total: validUrls.length };
}
