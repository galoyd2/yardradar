import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function FindSalesScreen() {
  const [location, setLocation] = useState(null);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'sales'));
        const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSales(loaded);
      } catch (error) {
        console.error('Error loading sales:', error);
      }
    };

    fetchSales();
  }, []);

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          {/* User location marker */}
          <Marker coordinate={location} pinColor="blue">
            <Callout><Text>You are here</Text></Callout>
          </Marker>

          {/* Yard sale markers */}
          {sales.map((sale) => {
            if (!sale.location || !sale.location.latitude || !sale.location.longitude) return null;

            return (
              <Marker
                key={sale.id}
                coordinate={{
                  latitude: sale.location.latitude,
                  longitude: sale.location.longitude,
                }}
                title={sale.title}
              >
                <Callout>
                  <View>
                    <Text style={{ fontWeight: 'bold' }}>{sale.title}</Text>
                    <Text>{sale.description}</Text>
                    <Text style={{ fontSize: 10, color: '#888' }}>
                      {new Date(sale.date).toLocaleString()}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      ) : (
        <Text style={styles.loading}>Loading map...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: {
    width: '100%',
    height: Dimensions.get('window').height,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    textAlign: 'center',
    paddingTop: 40,
    fontSize: 18,
  },
});
