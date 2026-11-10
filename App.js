import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { auth } from './firebaseConfig';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { registerForNearbySaleAlerts } from './utils/notifications';

import HomeScreen from './screens/HomeScreen';
import PostSaleScreen from './screens/PostSaleScreen';
import FindSalesScreen from './screens/FindSalesScreen';
import MyListingsScreen from './screens/MyListingsScreen';
import AuthScreen from './screens/AuthScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });

    return unsubscribe;
  }, []);

  // Register whenever someone is signed in
useEffect(() => {
  if (user) registerForNearbySaleAlerts(user.uid);
}, [user]);

// Tapping a notification opens Find Sales
const lastResponse = Notifications.useLastNotificationResponse();
useEffect(() => {
  if (!user || !lastResponse) return;
  if (lastResponse.notification.request.content.data?.type !== 'nearby-sale') return;
  const go = () => navigationRef.isReady() && navigationRef.navigate('Find Sales');
  if (navigationRef.isReady()) go();
  else setTimeout(go, 500);
}, [lastResponse, user]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading YardRadar...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName={user ? 'Home' : 'Login'}>
        {!user ? (
          <Stack.Screen name="Login" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Post Sale"
              component={PostSaleScreen}
              options={{
                title: 'List a Sale',
                presentation: 'modal', // This change should fix the dropdown clipping issue
              }} />
            <Stack.Screen name="Find Sales" component={FindSalesScreen} />
            <Stack.Screen name="My Listings" component={MyListingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
