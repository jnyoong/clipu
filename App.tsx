import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useShareIntent } from 'expo-share-intent';
import * as ExpoLinking from 'expo-linking';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import AddLinkScreen from './screens/AddLinkScreen';
import CollectionsScreen from './screens/CollectionsScreen';
import SharePickerScreen from './screens/SharePickerScreen';
import JoinCollectionScreen from './screens/JoinCollectionScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  AddLink: { collectionId?: string | null };
  Collections: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AppContent() {
  const { session, loading } = useAuth();
  const { shareIntent, resetShareIntent } = useShareIntent();
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (!shareIntent?.webUrl) return;
    const url = shareIntent.webUrl;
    resetShareIntent();
    setSharedUrl(url);
  }, [shareIntent?.webUrl]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = ExpoLinking.parse(url);
      if (parsed.scheme === 'clipu' && parsed.path) {
        const match = parsed.path.match(/^join\/(.+)$/);
        if (match) setPendingInviteCode(match[1]);
      }
    };

    ExpoLinking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = ExpoLinking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const inviteModal = session && pendingInviteCode ? (
    <Modal visible transparent animationType="slide">
      <JoinCollectionScreen
        inviteCode={pendingInviteCode}
        onJoined={() => setPendingInviteCode(null)}
        onCancel={() => setPendingInviteCode(null)}
      />
    </Modal>
  ) : null;

  if (!session) {
    return (
      <>
        <NavigationContainer>
          <StatusBar style="auto" />
          <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Signup" component={SignupScreen} />
          </AuthStack.Navigator>
        </NavigationContainer>
        {inviteModal}
      </>
    );
  }

  if (sharedUrl) {
    return (
      <>
        <StatusBar style="light" />
        <SharePickerScreen
          sharedUrl={sharedUrl}
          userId={session.user.id}
          onDone={() => setSharedUrl(null)}
        />
        {inviteModal}
      </>
    );
  }

  return (
    <>
      <NavigationContainer>
        <StatusBar style="auto" />
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="Home" component={HomeScreen} />
          <AppStack.Screen name="AddLink" component={AddLinkScreen} />
          <AppStack.Screen name="Collections" component={CollectionsScreen} />
        </AppStack.Navigator>
      </NavigationContainer>
      {inviteModal}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
