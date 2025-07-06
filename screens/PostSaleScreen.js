import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Dimensions, Alert } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function PostSaleScreen() {
  const [location, setLocation] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sales, setSales] = useState([]);

  // Get current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  // Load all sales from Firebase
  useEffect(() => {
    const loadSales = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'sales'));
        const loadedSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSales(loadedSales);
      } catch (error) {
        console.error('Error loading sales:', error);
      }
    };

    loadSales();
  }, []);

  // Post new sale
  const postSale = async () => {
    if (!title || !description || !location) {
      Alert.alert('Missing Info', 'Fill in all fields and allow location.');
      return;
    }

    try {
      await addDoc(collection(db, 'sales'), {
        title,
        description,
        location,
        date: new Date().toISOString(),
      });

      Alert.alert('Success', 'Yard sale posted!');
      setTitle('');
      setDescription('');

      // Reload updated sales
      const snapshot = await getDocs(collection(db, 'sales'));
      const updatedSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(updatedSales);
    } catch (error) {
      console.error('Error posting sale:', error);
    }
  };

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
          <Marker coordinate={location} pinColor="blue">
            <Callout><Text>You are here</Text></Callout>
          </Marker>

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

      <View style={styles.form}>
        <TextInput
          placeholder="Sale Title"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />
        <Button title="Post Yard Sale" onPress={postSale} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: {
    width: '100%',
    height: Dimensions.get('window').height / 2,
  },
  form: {
    padding: 10,
    backgroundColor: '#f9f9f9',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginVertical: 6,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    textAlign: 'center',
    paddingTop: 40,
    fontSize: 18,
  },
});
