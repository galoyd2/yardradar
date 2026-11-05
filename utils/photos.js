// utils/photos.js
// Picking, compressing, and uploading sale photos to Firebase Storage.
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseConfig';

export const MAX_PHOTOS = 5;
const MAX_WIDTH = 1280; // big enough for phones, small enough to stay in the free tier

// Opens the photo library and returns an array of local URIs.
export async function pickPhotos(remaining) {
  if (remaining <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 1, // we compress ourselves below
  });
  if (result.canceled) return [];
  return result.assets.slice(0, remaining).map((a) => a.uri);
}

// Opens the camera and returns an array with one local URI (or empty).
export async function takePhoto() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return [];
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return [];
  return [result.assets[0].uri];
}

// Resize to MAX_WIDTH and re-encode as JPEG (~150–300 KB per photo).
async function compress(uri) {
  const out = await manipulateAsync(uri, [{ resize: { width: MAX_WIDTH } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  return out.uri;
}

// fetch(uri).blob() is unreliable on Android in React Native, so use XHR.
function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new TypeError('Could not read image file'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

// Uploads one local image and returns { url, path }.
// Path layout: sales/{userId}/{saleId}/{file}.jpg — storage.rules relies on this.
export async function uploadSalePhoto(localUri, userId, saleId) {
  const compressedUri = await compress(localUri);
  const blob = await uriToBlob(compressedUri);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `sales/${userId}/${saleId}/${fileName}`;
  const storageRef = ref(storage, path);
  try {
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  } finally {
    if (blob.close) blob.close();
  }
  const url = await getDownloadURL(storageRef);
  return { url, path };
}

// Deletes a previously uploaded photo. Ignores "already gone".
export async function deleteSalePhoto(path) {
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') throw err;
  }
}
