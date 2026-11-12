const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const { geohashQueryBounds, distanceBetween } = require('geofire-common');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

const NEARBY_RADIUS_MILES = 15;
const NEARBY_RADIUS_M = NEARBY_RADIUS_MILES * 1609.34;

// Function that runs every day at 2 AM to delete expired sales
exports.deleteExpiredSales = onSchedule('0 2 * * *', async (event) => {
  try {
    console.log('Starting cleanup of expired sales...');
    
    const now = Timestamp.now();
    console.log('Current time:', now.toDate().toISOString());
    
    // Query for sales that have expired
    const expiredSalesQuery = db.collection('sales')
      .where('saleTimestamp', '<', now);
    
    const expiredSalesSnapshot = await expiredSalesQuery.get();
    
    if (expiredSalesSnapshot.empty) {
      console.log('No expired sales found');
      return null;
    }
    
    console.log(`Found ${expiredSalesSnapshot.size} expired sales to delete`);
    
    // Use batch write to delete all expired sales efficiently
    const batch = db.batch();
    
    expiredSalesSnapshot.docs.forEach((doc) => {
      console.log(`Marking for deletion: ${doc.id} - ${doc.data().title}`);
      batch.delete(doc.ref);
    });
    
    // Commit the batch delete
    await batch.commit();
    
    console.log(`Successfully deleted ${expiredSalesSnapshot.size} expired sales`);
    
    return null;
  } catch (error) {
    console.error('Error deleting expired sales:', error);
    throw error;
  }
});

// Optional: HTTP function for manual testing
exports.manualCleanup = onRequest(async (req, res) => {
  try {
    console.log('Manual cleanup triggered via HTTP');
    
    const now = Timestamp.now();
    
    const expiredSalesQuery = db.collection('sales')
      .where('saleTimestamp', '<', now);
    
    const expiredSalesSnapshot = await expiredSalesQuery.get();
    
    if (expiredSalesSnapshot.empty) {
      res.json({ message: 'No expired sales found', deleted: 0 });
      return;
    }
    
    const batch = db.batch();
    expiredSalesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    res.json({ 
      message: `Successfully deleted ${expiredSalesSnapshot.size} expired sales`,
      deleted: expiredSalesSnapshot.size 
    });
    
  } catch (error) {
    console.error('Error in manual cleanup:', error);
    res.status(500).json({ error: error.message });
  }
});
// ---------------------------------------------------------------------------
// Push a notification to every user within 15 miles when a sale is posted.
// Users' tokens + locations are saved by utils/notifications.js in the app.
// ---------------------------------------------------------------------------
exports.notifyNearbySale = onDocumentCreated('sales/{saleId}', async (event) => {
  const sale = event.data?.data();
  if (!sale?.coordinates) return null;

  // Don't announce sales that are already over
  if (sale.saleTimestamp && sale.saleTimestamp.toDate() < new Date()) return null;

  const center = [sale.coordinates.latitude, sale.coordinates.longitude];
  const bounds = geohashQueryBounds(center, NEARBY_RADIUS_M);

  const snapshots = await Promise.all(
    bounds.map(([start, end]) =>
      db.collection('users').orderBy('geohash').startAt(start).endAt(end).get()
    )
  );

  // Geohash boxes overshoot the circle, so filter by real distance
  const recipients = new Map(); // token -> uid (dedupes users seen in two boxes)
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const u = doc.data();
      if (doc.id === sale.userId) continue; // don't notify the poster
      if (!u.expoPushToken || u.notifyNearby === false) continue;
      const km = distanceBetween([u.lat, u.lng], center);
      if (km * 1000 <= NEARBY_RADIUS_M) recipients.set(u.expoPushToken, doc.id);
    }
  }
  if (recipients.size === 0) {
    console.log(`No users within ${NEARBY_RADIUS_MILES} mi of sale ${event.params.saleId}`);
    return null;
  }

  const when = sale.saleTimestamp
    ? sale.saleTimestamp.toDate().toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
      })
    : '';
  const tokens = [...recipients.keys()];
  const messages = tokens.map((to) => ({
    to,
    channelId: 'nearby-sales',
    sound: 'default',
    title: '📍 New yard sale nearby',
    body: when ? `${sale.title} · ${when}` : sale.title,
    data: { type: 'nearby-sale', saleId: event.params.saleId },
  }));

  // Expo accepts up to 100 messages per request
  const staleUids = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const json = await res.json();
    (json.data || []).forEach((ticket, j) => {
      if (ticket.status === 'error') {
        console.warn('Push error:', ticket.message, ticket.details);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          staleUids.push(recipients.get(chunk[j].to));
        }
      }
    });
  }

  // Forget tokens for uninstalled apps
  await Promise.all(
    staleUids.map((uid) =>
      db.collection('users').doc(uid).update({ expoPushToken: FieldValue.delete() })
    )
  );

  console.log(`Notified ${tokens.length} users about sale ${event.params.saleId}`);
  return null;
});

// ---------------------------------------------------------------------------
// Delete a sale's photos from Storage when the sale is deleted
// (covers both "delete" in My Listings and the nightly expired-sale cleanup).
// ---------------------------------------------------------------------------
exports.cleanupSalePhotos = onDocumentDeleted('sales/{saleId}', async (event) => {
  const sale = event.data?.data();
  if (!sale?.userId) return null;
  const prefix = `sales/${sale.userId}/${event.params.saleId}/`;
  await getStorage().bucket().deleteFiles({ prefix });
  console.log(`Deleted photos under ${prefix}`);
  return null;
});

// ---------------------------------------------------------------------------
// Delete the caller's account and everything they own.
// Called from the app's "Delete account" button (required by Google Play).
// ---------------------------------------------------------------------------
exports.deleteAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  // 1. Their sales (cleanupSalePhotos also fires for each one)
  const sales = await db.collection('sales').where('userId', '==', uid).get();
  const batch = db.batch();
  sales.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection('users').doc(uid)); // 2. Profile: location, push token, blocks
  await batch.commit();

  // 3. Any photos left behind
  await getStorage().bucket().deleteFiles({ prefix: `sales/${uid}/` });

  // 4. The login itself
  await getAuth().deleteUser(uid);

  console.log(`Deleted account ${uid} (${sales.size} sales)`);
  return { ok: true };
});
