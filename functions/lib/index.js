const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

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