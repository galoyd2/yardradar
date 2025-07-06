import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import PostSaleScreen from './screens/PostSaleScreen';
import FindSalesScreen from './screens/FindSalesScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Post Sale" component={PostSaleScreen} />
        <Stack.Screen name="Find Sales" component={FindSalesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
