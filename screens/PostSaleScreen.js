import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Dimensions, Image, Alert } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebaseConfig';
import { v4 as uuidv4 } from 'uuid';

export default function PostSaleScreen() {
  const [location, setLocation] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sales, setSales] = useState([]);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        Alert.alert('Authentication Required', 'You must be logged in to post a sale.');
      }
    });
    return unsubscribe;
  }, []);

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

  useEffect(() => {
    const loadSales = async () => {
      const snapshot = await getDocs(collection(db, 'sales'));
      const loadedSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(loadedSales);
    };

    loadSales();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImageAsync = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `yard_sales/${uuidv4()}`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const postSale = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Login Required', 'Please log in to post a sale.');
      return;
    }

    if (!title || !description || !location) {
      Alert.alert('Missing Info', 'Please fill out all fields.');
      return;
    }

    try {
      setUploading(true);

      let imageUrl = '';
      if (image) {
        imageUrl = await uploadImageAsync(image);
      }

      await addDoc(collection(db, 'sales'), {
        title,
        description,
        location,
        imageUrl,
        userId: user.uid,
        date: new Date().toISOString(),
      });

      Alert.alert('Success', 'Yard sale posted!');
      setTitle('');
      setDescription('');
      setImage(null);

      const snapshot = await getDocs(collection(db, 'sales'));
      const updated = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(updated);
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Upload Error', 'Something went wrong.');
    } finally {
      setUploading(false);
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
                  <View style={{ maxWidth: 250 }}>
                    <Text style={{ fontWeight: 'bold' }}>{sale.title}</Text>
                    <Text>{sale.description}</Text>
                    {sale.imageUrl && (
                      <Image
                        source={{ uri: sale.imageUrl }}
                        style={{ width: 200, height: 100, marginTop: 5, borderRadius: 5 }}
                      />
                    )}
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
        <Button title="📸 Pick an Image" onPress={pickImage} />
        {image && <Image source={{ uri: image }} style={styles.preview} />}
        <View style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden' }}>
          <Button
            title={uploading ? 'Uploading...' : 'Post Yard Sale'}
            onPress={postSale}
            disabled={uploading}
          />
        </View>
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
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    marginVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  preview: {
    width: '100%',
    height: 150,
    marginVertical: 10,
    borderRadius: 10,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    textAlign: 'center',
    paddingTop: 40,
    fontSize: 18,
  },
});
