import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Alert
} from 'react-native';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function MyListingsScreen() {
  const [mySales, setMySales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Use useCallback to memoize the fetch function
  const fetchMySales = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const salesRef = collection(db, 'sales');
      const q = query(salesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);

      const userSales = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort sales by the sale timestamp, showing upcoming sales first.
      userSales.sort((a, b) => {
        return (a.saleTimestamp?.toDate() || 0) - (b.saleTimestamp?.toDate() || 0);
      });
      setMySales(userSales);
    } catch (error) {
      console.error('Error fetching user sales:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Use useFocusEffect to refetch data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMySales();
    }, [fetchMySales])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMySales(); // fetchMySales will set refreshing to false
  }, [fetchMySales]);

  const handleDelete = async (id) => {
    try {
      // First, delete the document from Firestore.
      await deleteDoc(doc(db, 'sales', id));
      // Then, remove the item from the local state for an immediate UI update.
      setMySales(currentSales => currentSales.filter(sale => sale.id !== id));
      Alert.alert('Success', 'Listing deleted.');
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert('Error', 'Failed to delete listing. Please try again.');
    }
  };

  const confirmDelete = (id) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(id) },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (mySales.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>No sales posted yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={mySales}
      keyExtractor={item => item.id}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderItem={useCallback(({ item }) => {
          const saleDate = item.saleTimestamp?.toDate();
          const dateString = saleDate ? saleDate.toLocaleDateString() : 'Date not set';
          const timeString = saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time not set';
  
          return (
            <View style={styles.saleItem}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.dateText}>📅 {dateString} at {timeString}</Text>
  
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Post Sale', { editData: item })}
                  style={[styles.actionButton, { backgroundColor: '#FFA500' }]}
                >
                  <Text style={styles.buttonText}>Edit</Text>
                </TouchableOpacity>
  
                <TouchableOpacity
                  onPress={() => confirmDelete(item.id)}
                  style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        },
        [navigation] // Dependencies for the callback
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saleItem: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  description: {
    marginBottom: 8,
    color: '#555',
  },
  dateText: {
    color: '#333',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
