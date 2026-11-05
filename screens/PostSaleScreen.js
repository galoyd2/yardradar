import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GOOGLE_MAPS_API_KEY } from '@env';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  MAX_PHOTOS,
  pickPhotos,
  takePhoto,
  uploadSalePhoto,
  deleteSalePhoto,
} from '../utils/photos';

export default function PostSaleScreen({ navigation, route }) {
  const { editData } = route.params || {};
  const isEditMode = !!editData;

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
  // Photos already saved on the sale: [{ url, path }]
  const [existingPhotos, setExistingPhotos] = useState(editData?.photos || []);
  // Photos removed during this edit; deleted from Storage on save
  const [removedPhotos, setRemovedPhotos] = useState([]);
  // Local URIs picked but not yet uploaded
  const [newPhotoUris, setNewPhotoUris] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  const photoCount = existingPhotos.length + newPhotoUris.length;
  const remainingPhotos = MAX_PHOTOS - photoCount;

  const addPhotos = async (source) => {
    try {
      const uris = source === 'camera' ? await takePhoto() : await pickPhotos(remainingPhotos);
      if (uris.length) setNewPhotoUris((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS - existingPhotos.length));
    } catch (err) {
      console.error('Photo pick error:', err);
      Alert.alert('Error', 'Could not add that photo.');
    }
  };

  const removeExistingPhoto = (photo) => {
    setExistingPhotos((prev) => prev.filter((p) => p.path !== photo.path));
    setRemovedPhotos((prev) => [...prev, photo]);
  };

  const removeNewPhoto = (uri) => {
    setNewPhotoUris((prev) => prev.filter((u) => u !== uri));
  };

  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? 'Edit Sale' : 'Post a Sale',
      headerStyle: {
        backgroundColor: '#4A90E2',
      },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: {
        fontWeight: '600',
      },
    });
  }, [navigation, isEditMode]);

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
      setSaleDetails(prev => ({
        ...prev,
        location: suggestion.description,
      }));
    }
    
    setAddressSuggestions([]);
  };

  const handleSave = async () => {
    const { title, location, coordinates } = saleDetails;

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

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Not signed in', 'Please sign in again to post a sale.');
      return;
    }

    setIsSaving(true);
    try {
      const combinedDateTime = new Date(saleDetails.date);
      combinedDateTime.setHours(saleDetails.time.getHours(), saleDetails.time.getMinutes(), 0, 0);

      const saleData = {
        title: title.trim(),
        description: saleDetails.description,
        location: location,
        saleTimestamp: combinedDateTime,
        coordinates: coordinates,
        hasCoordinates: true,
        userId,
      };

      // Get the doc ref first so photos can be uploaded under the sale's ID
      // before the sale doc is created (the push notification fires on create).
      const saleDocRef = isEditMode
        ? doc(db, 'sales', editData.id)
        : doc(collection(db, 'sales'));

      const uploaded = [];
      for (let i = 0; i < newPhotoUris.length; i++) {
        setSaveStatus(`Uploading photo ${i + 1} of ${newPhotoUris.length}...`);
        uploaded.push(await uploadSalePhoto(newPhotoUris[i], userId, saleDocRef.id));
      }
      setSaveStatus('');
      saleData.photos = [...existingPhotos, ...uploaded];

      if (isEditMode) {
        await updateDoc(saleDocRef, saleData);
        // Only delete removed photos once the doc no longer points at them
        await Promise.all(removedPhotos.map((p) => deleteSalePhoto(p.path).catch(() => {})));
        Alert.alert('Success', 'Sale updated!');
      } else {
        await setDoc(saleDocRef, {
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
      setSaveStatus('');
    }
  };

  const formData = [{ key: 'form' }];

  const renderFormContent = () => (
    <LinearGradient
      colors={['#f8f9fa', '#ffffff']}
      style={styles.gradientContainer}
    >
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="storefront" size={32} color="#4A90E2" />
          </View>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Update Your Sale' : 'Create Your Sale'}
          </Text>
          <Text style={styles.headerSubtitle}>
            Fill in the details below to {isEditMode ? 'update' : 'list'} your yard sale
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Title Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              <Ionicons name="text" size={16} color="#4A90E2" /> Sale Title *
            </Text>
            <TextInput
              style={styles.input}
              value={saleDetails.title}
              onChangeText={(text) => setSaleDetails(prev => ({ ...prev, title: text }))}
              placeholder="e.g., Multi-Family Garage Sale"
              placeholderTextColor="#999"
            />
          </View>

          {/* Description Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              <Ionicons name="list" size={16} color="#4A90E2" /> Description
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={saleDetails.description}
              onChangeText={(text) => setSaleDetails(prev => ({ ...prev, description: text }))}
              multiline
              placeholder="Describe what you're selling (furniture, clothes, electronics, etc.)"
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
          </View>

          {/* Photos Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              <Ionicons name="images" size={16} color="#4A90E2" /> Photos ({photoCount}/{MAX_PHOTOS})
            </Text>
            {photoCount > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {existingPhotos.map((photo) => (
                  <View key={photo.path} style={styles.photoWrap}>
                    <Image source={{ uri: photo.url }} style={styles.photo} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removeExistingPhoto(photo)}>
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {newPhotoUris.map((uri) => (
                  <View key={uri} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removeNewPhoto(uri)}>
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {remainingPhotos > 0 && (
              <View style={styles.photoButtons}>
                <TouchableOpacity style={styles.photoButton} onPress={() => addPhotos('library')}>
                  <Ionicons name="images-outline" size={20} color="#4A90E2" />
                  <Text style={styles.photoButtonText}>Choose Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton} onPress={() => addPhotos('camera')}>
                  <Ionicons name="camera-outline" size={20} color="#4A90E2" />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Address Field */}
          <View style={[styles.fieldContainer, { zIndex: 1000, position: 'relative' }]}>
            <Text style={styles.label}>
              <Ionicons name="location" size={16} color="#4A90E2" /> Address *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Start typing your address..."
              placeholderTextColor="#999"
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
              <View style={styles.suggestionContainer}>
                {addressSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.suggestionItem,
                      { borderBottomWidth: index < addressSuggestions.length - 1 ? 1 : 0 }
                    ]}
                    onPress={() => selectAddress(suggestion)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.suggestionText}>{suggestion.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              <Ionicons name="calendar" size={16} color="#4A90E2" /> Sale Date *
            </Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateTimeButton}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.dateTimeText}>{saleDetails.date.toDateString()}</Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
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
          </View>

          {/* Time Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              <Ionicons name="time" size={16} color="#4A90E2" /> Start Time *
            </Text>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateTimeButton}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.dateTimeText}>
                {saleDetails.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
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
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          {isSaving ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>
                {saveStatus || (isEditMode ? 'Updating sale...' : 'Posting sale...')}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.submitButton} onPress={handleSave} activeOpacity={0.8}>
              <LinearGradient
                colors={['#4A90E2', '#357ABD']}
                style={styles.buttonGradient}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {isEditMode ? 'Update Sale' : 'Post Sale'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient>
  );
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      <FlatList
        data={formData}
        renderItem={renderFormContent}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        style={styles.flatList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#4A90E2',
  },
  flatList: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
    minHeight: '100%',
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E6BA8',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  formSection: {
    marginBottom: 32,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E6BA8',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#E1E8ED',
    padding: 16,
    fontSize: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  photoRow: {
    marginBottom: 12,
  },
  photoWrap: {
    marginRight: 10,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#E1E8ED',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E1E8ED',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  photoButtonText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#4A90E2',
    fontWeight: '600',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#E1E8ED',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 12,
  },
  suggestionContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 12,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  buttonContainer: {
    marginTop: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  submitButton: {
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
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});