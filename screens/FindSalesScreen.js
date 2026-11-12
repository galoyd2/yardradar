import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { shareSale } from '../utils/share';
import { auth } from '../firebaseConfig';
import { getBlockedUsers, showSaleOptions } from '../utils/moderation';

export default function FindSalesScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const [initialRegion, setInitialRegion] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'weekend'
  const [viewerPhoto, setViewerPhoto] = useState(null); // full-screen photo URL

  useEffect(() => {
    let isMounted = true;

    const setupScreen = async () => {
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed to show sales near you.');
        if (isMounted) {
          setInitialRegion({
            latitude: 37.0902,
            longitude: -95.7129,
            latitudeDelta: 30,
            longitudeDelta: 30,
          });
        }
      } else {
        const location = await Location.getCurrentPositionAsync({});
        const region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.5, // Zoom in closer
          longitudeDelta: 0.5,
        };
        if (isMounted) {
          setInitialRegion(region);
          setUserLocation(region);
        }
      }

      fetchSales();
    };

    setupScreen();

    return () => {
      isMounted = false;
    };
  }, []);

  // This function is wrapped in useCallback to prevent it from being recreated on every render,
  // which would cause an infinite loop in the useEffect that depends on it.
  // Fixed fetchSales function
    // Fixed fetchSales function
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const blocked = await getBlockedUsers();
        setSales(salesData.filter((s) => !blocked.includes(s.userId)));
      let q = query(salesRef, where('hasCoordinates', '==', true));

      if (dateFilter === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        
        // Use Firestore Timestamp for comparison
        const startTimestamp = Timestamp.fromDate(start);
        const endTimestamp = Timestamp.fromDate(end);
        
        q = query(q, 
          where('saleTimestamp', '>=', startTimestamp), 
          where('saleTimestamp', '<', endTimestamp)
        );
      }

      const snapshot = await getDocs(q);
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(salesData);
    } catch (err) {
      console.error('Error fetching sales:', err);
      Alert.alert('Error', 'Could not fetch sales data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFilter]);

  // Refetch sales when the date filter changes
  useEffect(() => {
    // Only fetch if the initial location has been determined
    if (initialRegion) {
      fetchSales();
    }
  }, [fetchSales, initialRegion]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSales();
  };

  const handleListItemPress = (item) => {
    if (mapRef.current && item.coordinates) {
      mapRef.current.animateToRegion(
        {
          ...item.coordinates,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000 // Animate over 1 second
      );

      setSelectedSaleId(item.id);

      const marker = markerRefs.current[item.id];
      if (marker) {
        // A short delay can help ensure the map has moved before showing the callout
        setTimeout(() => marker.showCallout(), 1000);
      }
    }
  };

  const handleMapPress = () => {
    // Deselect marker when map is pressed
    setSelectedSaleId(null);
  };

  const reCenterMap = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion(userLocation, 1000);
    } else {
      Alert.alert("Location not available", "Could not get your current location.");
    }
  };

  if (loading || !initialRegion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Finding sales near you...</Text>
      </View>
    );
  }

  const renderSaleItem = ({ item }) => {
    const saleDate = item.saleTimestamp?.toDate();
    const dateString = saleDate ? saleDate.toLocaleDateString() : 'Date not set';
    const timeString = saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time not set';

    return (
      <TouchableOpacity onPress={() => handleListItemPress(item)}>
        <View style={styles.listItem}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { flex: 1 }]}>{item.title}</Text>
            <TouchableOpacity
              onPress={() => shareSale(item)}
              style={styles.shareButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="share-social-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            {item.userId !== auth.currentUser?.uid && (
            <TouchableOpacity
              onPress={() =>
                showSaleOptions(item, {
                  onSellerHidden: (sellerId) =>
                    setSales((prev) => prev.filter((s) => s.userId !== sellerId)),
                })
              }
              style={styles.shareButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </TouchableOpacity>
          )}
          </View>
          <Text style={styles.text}>📍 {item.location}</Text>
          <Text style={styles.text}>📅 {dateString}</Text>
          <Text style={styles.text}>🕒 {timeString}</Text>
          {item.photos?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {item.photos.map((photo) => (
                <TouchableOpacity key={photo.path} onPress={() => setViewerPhoto(photo.url)}>
                  <Image source={{ uri: photo.url }} style={styles.thumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, dateFilter === 'all' && styles.activeFilter]}
          onPress={() => setDateFilter('all')}>
          <Text style={styles.filterText}>All Sales</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, dateFilter === 'today' && styles.activeFilter]}
          onPress={() => setDateFilter('today')}>
          <Text style={styles.filterText}>Today</Text>
        </TouchableOpacity>
        {/* Add a "This Weekend" button here with its own logic */}
      </View>

      <MapView
        style={styles.map}
        ref={mapRef}
        initialRegion={initialRegion}
        showsUserLocation={true}
        onPress={handleMapPress}
      >
        {sales.map((sale) => {
          const saleDate = sale.saleTimestamp?.toDate();
          const dateString = saleDate ? saleDate.toLocaleDateString() : 'N/A';
          const timeString = saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

          return (
            <Marker
              key={sale.id}
              ref={(el) => (markerRefs.current[sale.id] = el)}
              coordinate={sale.coordinates}
              pinColor={selectedSaleId === sale.id ? 'gold' : 'red'}
              title={sale.title}
              description={sale.location}
            >
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{sale.title}</Text>
                  <Text>📍 {sale.location}</Text>
                  <Text>📅 {dateString}</Text>
                  <Text>🕒 {timeString}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {userLocation && (
        <TouchableOpacity style={styles.recenterButton} onPress={reCenterMap}>
          <Ionicons name="locate" size={24} color="#007AFF" />
        </TouchableOpacity>
      )}

      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={renderSaleItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          !loading && <View style={styles.centered}><Text>No sales found.</Text></View>
        )}
      />

      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewerPhoto(null)}>
          {viewerPhoto && <Image source={{ uri: viewerPhoto }} style={styles.viewerImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    height: 300,
    width: '100%',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
  },
  activeFilter: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    color: 'black',
  },
  recenterButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  callout: {
    width: 250,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 6,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 60,
  },
  listItem: {
    backgroundColor: '#f0f0f0',
    padding: 14,
    marginBottom: 10,
    borderRadius: 8,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareButton: {
    paddingLeft: 12,
  },
  text: {
    fontSize: 14,
    marginTop: 2,
  },
  photoRow: {
    marginTop: 10,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#ddd',
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
});
