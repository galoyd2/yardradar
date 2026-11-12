// utils/notifications.js
// Registers this device for push and saves its token + rough location to
// users/{uid}, so the notifyNearbySale Cloud Function can find nearby users.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from '../firebaseConfig';

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getPushToken() {
  if (!Device.isDevice) return null; // emulators can't receive push

  if (Platform.OS === 'android') {
    // Android 13+ needs a channel before the permission prompt will show.
    await Notifications.setNotificationChannelAsync('nearby-sales', {
      name: 'Nearby sales',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

async function getRoughLocation() {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  }
  if (status !== 'granted') return null;

  // Last known is instant and plenty accurate for a 15-mile radius.
  const pos =
    (await Location.getLastKnownPositionAsync()) ||
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
}

// Call on every app open while signed in. Failures are non-fatal.
export async function registerForNearbySaleAlerts(uid) {
  try {
    // One at a time: Android can only show one permission dialog at once,
    // and asking for both together can leave one request hanging forever.
    const token = await getPushToken();
    const loc = await getRoughLocation();
    const update = { updatedAt: serverTimestamp() };
    if (token) update.expoPushToken = token;
    if (loc) {
      update.lat = loc.lat;
      update.lng = loc.lng;
      update.geohash = geohashForLocation([loc.lat, loc.lng]);
    }
    if (!token && !loc) return;
    await setDoc(doc(db, 'users', uid), update, { merge: true });
  } catch (err) {
    console.warn('Push registration failed:', err);
  }
}
