import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Alert, SafeAreaView, StatusBar
} from 'react-native';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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

  // Check if sale is expired
  const isSaleExpired = (saleTimestamp) => {
    if (!saleTimestamp) return false;
    return saleTimestamp.toDate() < new Date();
  };

  const renderEmptyState = () => (
    <LinearGradient colors={['#f8f9fa', '#ffffff']} style={styles.emptyContainer}>
      <View style={styles.emptyContent}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="storefront-outline" size={64} color="#4A90E2" />
        </View>
        <Text style={styles.emptyTitle}>No Sales Yet</Text>
        <Text style={styles.emptySubtitle}>
          Ready to start selling? Create your first yard sale listing and reach neighbors in your area.
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('Post Sale')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#4A90E2', '#357ABD']} style={styles.createButtonGradient}>
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create First Sale</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderLoadingState = () => (
    <LinearGradient colors={['#f8f9fa', '#ffffff']} style={styles.loadingContainer}>
      <View style={styles.loadingContent}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading your sales...</Text>
      </View>
    </LinearGradient>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="list" size={28} color="#4A90E2" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>My Listings</Text>
          <Text style={styles.headerSubtitle}>
            {mySales.length} {mySales.length === 1 ? 'sale' : 'sales'} posted
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
        {renderLoadingState()}
      </SafeAreaView>
    );
  }

  if (mySales.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
        {renderEmptyState()}
      </SafeAreaView>
    );
  }

  const renderSaleItem = ({ item }) => {
    const saleDate = item.saleTimestamp?.toDate();
    const dateString = saleDate ? saleDate.toLocaleDateString() : 'Date not set';
    const timeString = saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time not set';
    const isExpired = isSaleExpired(item.saleTimestamp);

    return (
      <View style={[styles.saleItem, isExpired && styles.expiredSaleItem]}>
        {isExpired && (
          <View style={styles.expiredBadge}>
            <Ionicons name="time-outline" size={14} color="#FF6B6B" />
            <Text style={styles.expiredText}>Expired</Text>
          </View>
        )}
        
        <View style={styles.saleHeader}>
          <View style={styles.saleIconContainer}>
            <Ionicons name="storefront" size={20} color="#4A90E2" />
          </View>
          <View style={styles.saleInfo}>
            <Text style={[styles.title, isExpired && styles.expiredTitle]}>{item.title}</Text>
            {item.description ? (
              <Text style={[styles.description, isExpired && styles.expiredDescription]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.dateLocationContainer}>
          <View style={styles.dateTimeRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.dateTimeText}>{dateString}</Text>
          </View>
          <View style={styles.dateTimeRow}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.dateTimeText}>{timeString}</Text>
          </View>
          {item.location && (
            <View style={styles.dateTimeRow}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Post Sale', { editData: item })}
            style={styles.editButton}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={16} color="#4A90E2" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => confirmDelete(item.id)}
            style={styles.deleteButton}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      <LinearGradient colors={['#f8f9fa', '#ffffff']} style={styles.container}>
        <FlatList
          data={mySales}
          keyExtractor={item => item.id}
          onRefresh={onRefresh}
          refreshing={refreshing}
          renderItem={renderSaleItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#4A90E2',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E6BA8',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E6BA8',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  saleItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  expiredSaleItem: {
    backgroundColor: '#F8F8F8',
    opacity: 0.8,
  },
  expiredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiredText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
    marginLeft: 4,
  },
  saleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  saleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  saleInfo: {
    flex: 1,
    paddingRight: 40, // Space for expired badge
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E6BA8',
    marginBottom: 6,
  },
  expiredTitle: {
    color: '#999',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  expiredDescription: {
    color: '#AAA',
  },
  dateLocationContainer: {
    marginBottom: 20,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  editButtonText: {
    color: '#4A90E2',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
});