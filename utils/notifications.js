// utils/notifications.js
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from '../firebaseConfig';

// Show notifications even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getPushToken() {
  // Emulators can't receive push
  if (!Device.isDevice) return null;

  // Android 8+ requires a channel; Android 13+ won't show the
  // permission prompt until one exists
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('nearby-sales', {
      name: 'Nearby sales',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Check first, only ask if needed
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  // projectId tells Expo which project this token belongs to
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data; // "ExponentPushToken[...]"
}

async function getRoughLocation() {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  }
  if (status !== 'granted') return null;

  // Last known position is instant and accurate enough for 15 miles
  const pos =
    (await Location.getLastKnownPositionAsync()) ||
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
}

// Call this every time a signed-in user opens the app
// Call this every time a signed-in user opens the app
export async function registerForNearbySaleAlerts(uid) {
  console.log('REGISTER: start for', uid);
  try {
    const token = await getPushToken();
    console.log('REGISTER: token =', token);

    const loc = await getRoughLocation();
    console.log('REGISTER: loc =', loc);

    if (!token && !loc) return;

    const update = { updatedAt: serverTimestamp() };
    if (token) update.expoPushToken = token;
    if (loc) {
      update.lat = loc.lat;
      update.lng = loc.lng;
      update.geohash = geohashForLocation([loc.lat, loc.lng]);
    }
    // merge: true updates these fields without wiping anything else
    await setDoc(doc(db, 'users', uid), update, { merge: true });
    console.log('REGISTER: saved');
  } catch (err) {
    console.warn('Push registration failed:', err);
  }
}