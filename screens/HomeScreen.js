import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import YardRadarIcon from '../components/YardRadarIcon'; // Import your custom icon

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      
      <LinearGradient
        colors={['#4A90E2', '#357ABD', '#2E6BA8']}
        style={styles.gradientContainer}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* Replace the Ionicons radar with your custom icon */}
            <YardRadarIcon size={80} animate={true} />
          </View>
          <Text style={styles.title}>YardRadar</Text>
          <Text style={styles.subtitle}>Discover treasures in your neighborhood</Text>
        </View>

        {/* Main Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.shadowStyle]}
            onPress={() => navigation.navigate('Find Sales')}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="search" size={24} color="#4A90E2" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.primaryButtonText}>Find Yard Sales</Text>
                <Text style={styles.buttonSubtext}>Browse sales near you</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, styles.shadowStyle]}
            onPress={() => navigation.navigate('Post Sale')}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="add-circle" size={24} color="#4A90E2" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.primaryButtonText}>Post a Yard Sale</Text>
                <Text style={styles.buttonSubtext}>List your items for sale</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.secondaryButton, styles.shadowStyle]}
            onPress={() => navigation.navigate('My Listings')}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="list" size={22} color="#FFFFFF" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.secondaryButtonText}>My Listings</Text>
                <Text style={styles.secondaryButtonSubtext}>Manage your sales</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Start exploring your local community</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A90E2',
  },
  gradientContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 16,
    // Remove the old styling since we're using the custom SVG
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '400',
  },
  actionsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginVertical: 8,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 2,
  },
  shadowStyle: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E6BA8',
    marginBottom: 2,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  secondaryButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});