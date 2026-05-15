import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
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
  Home: { joinedAt?: number } | undefined;
  AddLink: { collectionId?: string | null };
  Collections: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AndroidShareHandler({ onShare }: { onShare: (url: string) => void }) {
  const { shareIntent, resetShareIntent } = useShareIntent();
  useEffect(() => {
    if (!shareIntent?.webUrl) return;
    const url = shareIntent.webUrl;
    resetShareIntent();
    onShare(url);
  }, [shareIntent?.webUrl]);
  return null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <View style={{ flex: 1, padding: 40, paddingTop: 80, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red' }}>앱 오류</Text>
          <Text selectable style={{ marginTop: 12 }}>{String(err.message)}</Text>
          <Text selectable style={{ marginTop: 12, fontSize: 11, color: '#555' }}>{String(err.stack)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { session, loading } = useAuth();
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const navRef = useRef<NavigationContainerRef<AppStackParamList>>(null);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = ExpoLinking.parse(url);
      if (parsed.scheme === 'clipu') {
        // clipu://join/CODE → hostname='join', path='CODE'
        // 또는 clipu://join/CODE → path='join/CODE' 두 경우 모두 처리
        const code =
          parsed.hostname === 'join' && parsed.path
            ? parsed.path
            : parsed.path?.match(/^join\/(.+)$/)?.[1] ?? null;
        if (code) setPendingInviteCode(code);
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
        onJoined={() => {
          setPendingInviteCode(null);
          navRef.current?.navigate('Home', { joinedAt: Date.now() });
        }}
        onCancel={() => setPendingInviteCode(null)}
      />
    </Modal>
  ) : null;

  if (!session) {
    return (
      <>
        {Platform.OS === 'android' && <AndroidShareHandler onShare={setSharedUrl} />}
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
        {Platform.OS === 'android' && <AndroidShareHandler onShare={setSharedUrl} />}
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
      {Platform.OS === 'android' && <AndroidShareHandler onShare={setSharedUrl} />}
      <NavigationContainer ref={navRef}>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
