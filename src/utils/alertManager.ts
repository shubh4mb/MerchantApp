import { Vibration } from 'react-native';
import { Audio } from 'expo-av';

let alertSound: Audio.Sound | null = null;
let isAlerting = false;

// 1000ms wait, 2000ms vibrate
const VIBRATION_PATTERN = [0, 2000, 1000];

export const playOrderAlert = async () => {
  if (isAlerting) return;
  isAlerting = true;

  try {
    // Start aggressive looping vibration
    try {
      Vibration.vibrate(VIBRATION_PATTERN, true);
    } catch (vibErr) {
      console.warn("Vibration error:", vibErr);
    }

    // Play alert sound
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    let sound: Audio.Sound | null = null;
    try {
      const source = require('../../assets/sounds/order-alert.mp3');
      const soundObj = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true, isLooping: true }
      );
      sound = soundObj.sound;
    } catch (localErr) {
      console.warn("Failed to load local alert sound, attempting remote fallback:", localErr);
      try {
        const soundObj = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
          { shouldPlay: true, isLooping: true }
        );
        sound = soundObj.sound;
      } catch (remoteErr) {
        console.error("Remote audio fallback failed:", remoteErr);
      }
    }
    alertSound = sound;
  } catch (error) {
    console.error("Error playing order alert sound:", error);
    isAlerting = false;
  }
};

export const stopOrderAlert = async () => {
  isAlerting = false;

  try {
    // Stop vibration
    Vibration.cancel();

    // Stop and unload sound
    if (alertSound) {
      await alertSound.stopAsync().catch(() => {});
      await alertSound.unloadAsync().catch(() => {});
      alertSound = null;
    }
  } catch (error) {
    console.error("Error stopping order alert:", error);
  }
};
