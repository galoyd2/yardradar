const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { geohashQueryBounds, distanceBetween } = require('geofire-common'); 
const { initializeApp } = require('firebase-admin/app');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');


// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

const RADIUS_MILES = 15;
const RADIUS_M = RADIUS_MILES * 1609.34;

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

exports.notifyNearbySale = onDocumentCreated('sales/{saleId}', async (event) => {
  const sale = event.data?.data();
  if (!sale?.coordinates) return null;
  if (sale.saleTimestamp && sale.saleTimestamp.toDate() < new Date()) return null;

  // 1. Find users near the sale
  const center = [sale.coordinates.latitude, sale.coordinates.longitude];
  const bounds = geohashQueryBounds(center, RADIUS_M);
  const snapshots = await Promise.all(
    bounds.map(([start, end]) =>
      db.collection('users').orderBy('geohash').startAt(start).endAt(end).get()
    )
  );

  // 2. Geohash boxes are squares that overshoot the circle,
  //    so double-check the real distance
  const recipients = new Map(); // token -> uid
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const u = doc.data();
      if (doc.id === sale.userId) continue;      // skip the poster
      if (!u.expoPushToken) continue;
      const km = distanceBetween([u.lat, u.lng], center);
      if (km * 1000 <= RADIUS_M) recipients.set(u.expoPushToken, doc.id);
    }
  }
  if (recipients.size === 0) return null;

  // 3. Build the messages
  const messages = [...recipients.keys()].map((to) => ({
    to,
    channelId: 'nearby-sales',  // must match the channel created in the app
    sound: 'default',
    title: '📍 New yard sale nearby',
    body: sale.title,
    data: { type: 'nearby-sale', saleId: event.params.saleId },
  }));

  // 4. Send to Expo in batches of 100 (their limit)
  const staleUids = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    const { data = [] } = await res.json();
    data.forEach((ticket, j) => {
      // App was uninstalled, so forget the token
      if (ticket.details?.error === 'DeviceNotRegistered') {
        staleUids.push(recipients.get(chunk[j].to));
      }
    });
  }

  await Promise.all(
    staleUids.map((uid) =>
      db.collection('users').doc(uid).update({ expoPushToken: FieldValue.delete() })
    )
  );

  console.log(`Notified ${messages.length} users about ${event.params.saleId}`);
  return null;
});