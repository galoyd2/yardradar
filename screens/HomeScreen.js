import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to YardRadar!</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Find Sales')}
      >
        <Text style={styles.buttonText}>🔍 Find Yard Sales</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Post Sale')}
      >
        <Text style={styles.buttonText}>📍 Post a Yard Sale</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('My Listings')}
      >
        <Text style={styles.buttonText}>📋 View My Listings</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 40, textAlign: 'center' },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 12,
    width: '90%',
    alignItems: 'center',
    elevation: 2, // for slight shadow on Android
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
