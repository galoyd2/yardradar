import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to YardRadar!</Text>
      <View style={styles.button}>
        <Button title="Find Yard Sales" onPress={() => navigation.navigate('Find Sales')} />
      </View>
      <View style={styles.button}>
        <Button title="Post a Yard Sale" onPress={() => navigation.navigate('Post Sale')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  button: { marginVertical: 10, width: 200 },
});
