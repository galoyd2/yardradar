import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_MAPS_API_KEY } from '@env';
import axios from 'axios';

console.log('Google Maps Key:', GOOGLE_MAPS_API_KEY);

export default function PostSaleScreen({ navigation, route }) {
  const { editData } = route.params || {};
  const isEditMode = !!editData;

  // If editing, use the saleTimestamp from Firestore, otherwise use the current date.
  // The .toDate() method converts a Firestore Timestamp to a JS Date object.
  const initialSaleDate = editData?.saleTimestamp ? editData.saleTimestamp.toDate() : new Date();

  const [saleDetails, setSaleDetails] = useState({
    title: editData?.title || '',
    description: editData?.description || '',
    location: editData?.location || '',
    date: initialSaleDate,
    time: initialSaleDate,
    coordinates: editData?.coordinates || null,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? 'Edit Sale' : 'Post a Sale',
    });
  }, [navigation, isEditMode]);

  useEffect(() => {
    const testGooglePlacesAPI = async () => {
      try {
        const res = await axios.get(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json`,
          {
            params: {
              input: '123 Main St',
              key: GOOGLE_MAPS_API_KEY,
              types: 'address',
              language: 'en',
            },
          }
        );
        console.log('✅ Google Places test:', res.data);
        if (res.data.error_message) {
          console.warn('⚠️ Google API error:', res.data.error_message);
        }
      } catch (error) {
        console.error('❌ Axios error:', error.message);
      }
    };

    testGooglePlacesAPI();
  }, []);

  const searchAddresses = async (input) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json`,
        {
          params: {
            input: input,
            key: GOOGLE_MAPS_API_KEY,
            types: 'address',
            language: 'en',
          },
        }
      );
      
      if (response.data.status === 'OK') {
        setAddressSuggestions(response.data.predictions);
      } else {
        console.warn('Places API error:', response.data.status);
        setAddressSuggestions([]);
      }
    } catch (error) {
      console.error('Address search error:', error);
      setAddressSuggestions([]);
    }
  };

  const selectAddress = async (suggestion) => {
    try {
      // Get place details including coordinates
      const detailsResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json`,
        {
          params: {
            place_id: suggestion.place_id,
            fields: 'geometry,formatted_address',
            key: GOOGLE_MAPS_API_KEY,
          },
        }
      );

      if (detailsResponse.data.status === 'OK') {
        const place = detailsResponse.data.result;
        setSaleDetails(prev => ({
          ...prev,
          location: suggestion.description,
          coordinates: {
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
          },
        }));
      }
    } catch (error) {
      console.error('Place details error:', error);
      // Still set the location even if we can't get coordinates
      setSaleDetails(prev => ({
        ...prev,
        location: suggestion.description,
      }));
    }
    
    setAddressSuggestions([]);
  };

  const handleSave = async () => {
    // De-structure for easier access and add trim() to title check
    const { title, location, coordinates } = saleDetails;

    // More specific validation checks for better user feedback
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please provide a title for your sale.');
      return;
    }

    if (!location || !coordinates) {
      Alert.alert(
        'Invalid Address',
        'Please type an address and select a valid option from the dropdown list to confirm the location.'
      );
      return;
    }

    setIsSaving(true);
    try {
      // Combine the date and time into a single JavaScript Date object.
      const combinedDateTime = new Date(saleDetails.date);
      combinedDateTime.setHours(saleDetails.time.getHours(), saleDetails.time.getMinutes(), 0, 0);

      const saleData = {
        title: title.trim(),
        description: saleDetails.description,
        location: location,
        // Store as a single timestamp for easier querying and sorting in Firestore.
        saleTimestamp: combinedDateTime,
        coordinates: coordinates,
        hasCoordinates: true,
        userId: auth.currentUser?.uid || null,
      };

      if (isEditMode) {
        const saleDocRef = doc(db, 'sales', editData.id);
        await updateDoc(saleDocRef, saleData);
        Alert.alert('Success', 'Sale updated!');
      } else {
        await addDoc(collection(db, 'sales'), {
          ...saleData,
          createdAt: serverTimestamp(),
        });
        Alert.alert('Success', 'Sale posted!');
      }

      navigation.goBack();
    } catch (err) {
      console.error('Error saving sale:', err);
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'post'} sale. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Create a single item array for FlatList
  const formData = [{ key: 'form' }];

  const renderFormContent = () => (
    <View style={styles.container}>
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={saleDetails.title}
        onChangeText={(text) => setSaleDetails(prev => ({ ...prev, title: text }))}
        placeholder="e.g., Neighborhood Garage Sale"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
        value={saleDetails.description}
        onChangeText={(text) => setSaleDetails(prev => ({ ...prev, description: text }))}
        multiline
        placeholder="e.g., Furniture, clothes, and toys"
      />

      {/* Custom Google Places implementation */}
      <View style={{ zIndex: 1000, position: 'relative', marginBottom: 200 }}>
        <Text style={styles.label}>Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter address"
          value={saleDetails.location}
          onChangeText={(text) => {
            setSaleDetails(prev => ({ ...prev, location: text }));
            if (text.length > 2) {
              searchAddresses(text);
            } else {
              setAddressSuggestions([]);
            }
          }}
        />
        
        {addressSuggestions.length > 0 && (
          <View style={{
            position: 'absolute',
            top: 100,
            left: 0,
            right: 0,
            backgroundColor: 'white',
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 10,
            maxHeight: 200,
            zIndex: 1000,
            elevation: 1000,
          }}>
            {addressSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  padding: 15,
                  borderBottomWidth: index < addressSuggestions.length - 1 ? 1 : 0,
                  borderBottomColor: '#eee',
                }}
                onPress={() => selectAddress(suggestion)}
              >
                <Text>{suggestion.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.label}>Date *</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
        <Text>{saleDetails.date.toDateString()}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={saleDetails.date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) setSaleDetails(prev => ({ ...prev, date: selectedDate }));
          }}
        />
      )}

      <Text style={styles.label}>Time *</Text>
      <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.input}>
        <Text>{saleDetails.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          value={saleDetails.time}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(Platform.OS === 'ios');
            if (selectedTime) setSaleDetails(prev => ({ ...prev, time: selectedTime }));
          }}
        />
      )}

      <View style={{ marginTop: 30, marginBottom: 20 }}>
        {isSaving ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : (
          <Button
            title={isEditMode ? 'Update Sale' : 'Post Sale'}
            onPress={handleSave}
          />
        )}
      </View>
    </View>
  );
  
  return (
    <FlatList
      data={formData}
      renderItem={renderFormContent}
      keyExtractor={(item) => item.key}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40, // Add padding to the bottom for better scrolling
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { textAlign: 'center', fontSize: 16, color: 'red', marginBottom: 10 },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    fontSize: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    minHeight: 50,
  },
});