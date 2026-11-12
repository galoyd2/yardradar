// utils/moderation.js
// Report listings, hide sellers, and delete your account.
// Google Play requires report/block for apps with user-generated content,
// and in-app account deletion for apps with sign-up.
import { Alert } from 'react-native';
import {
  addDoc, collection, doc, getDoc, setDoc, arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { auth, db, functions } from '../firebaseConfig';

// ---- Blocking -------------------------------------------------------------

// Returns the list of seller IDs the current user has hidden.
export async function getBlockedUsers() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data().blockedUsers || [] : [];
  } catch (err) {
    console.warn('Could not load blocked users:', err);
    return [];
  }
}

async function blockUser(sellerId) {
  const uid = auth.currentUser.uid;
  await setDoc(doc(db, 'users', uid), { blockedUsers: arrayUnion(sellerId) }, { merge: true });
}

// ---- Reporting ------------------------------------------------------------

async function reportSale(sale, reason) {
  await addDoc(collection(db, 'reports'), {
    saleId: sale.id,
    saleTitle: sale.title || '',
    sellerId: sale.userId || null,
    reporterId: auth.currentUser.uid,
    reason,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

// ---- The "⋯" menu on a sale ----------------------------------------------
// Android alerts show at most 3 buttons, so this is two small menus.

export function showSaleOptions(sale, { onSellerHidden } = {}) {
  Alert.alert(sale.title || 'Sale', 'What would you like to do?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Hide this seller', onPress: () => confirmHide(sale, onSellerHidden) },
    { text: 'Report listing', onPress: () => chooseReportReason(sale) },
  ]);
}

function chooseReportReason(sale) {
  Alert.alert('Report listing', 'Why are you reporting this listing?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Spam or scam', onPress: () => submitReport(sale, 'spam_or_scam') },
    { text: 'Inappropriate', onPress: () => submitReport(sale, 'inappropriate') },
  ]);
}

async function submitReport(sale, reason) {
  try {
    await reportSale(sale, reason);
    Alert.alert('Thanks for letting us know', 'We will review this listing.');
  } catch (err) {
    console.error('Report failed:', err);
    Alert.alert('Error', 'Could not send the report. Please try again.');
  }
}

function confirmHide(sale, onSellerHidden) {
  Alert.alert(
    'Hide this seller?',
    "You won't see any listings from this seller anymore.",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(sale.userId);
            onSellerHidden?.(sale.userId);
          } catch (err) {
            console.error('Hide failed:', err);
            Alert.alert('Error', 'Could not hide this seller.');
          }
        },
      },
    ]
  );
}

// ---- Account deletion -----------------------------------------------------

export function confirmDeleteAccount() {
  Alert.alert(
    'Delete your account?',
    'This permanently deletes your account, your listings, and their photos. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await httpsCallable(functions, 'deleteAccount')();
            await signOut(auth); // App.js sends the user back to Login
            Alert.alert('Account deleted', 'Your account and data have been removed.');
          } catch (err) {
            console.error('Delete account failed:', err);
            Alert.alert('Error', 'Could not delete your account. Please try again.');
          }
        },
      },
    ]
  );
}
