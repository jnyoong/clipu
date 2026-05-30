import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useShareIntent } from 'expo-share-intent';
import * as ExpoLinking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { registerForPushNotifications } from './lib/pushNotifications';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import AddLinkScreen from './screens/AddLinkScreen';
import CollectionsScreen from './screens/CollectionsScreen';
import SharePickerScreen from './screens/SharePickerScreen';
import JoinCollectionScreen from './screens/JoinCollectionScreen';
import ExploreScreen from './screens/ExploreScreen';
import CollectionDetailScreen from './screens/CollectionDetailScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type HomeStackParamList = {
  Home: { joinedAt?: number } | undefined;
  AddLink: { collectionId?: string | null };
  Collections: undefined;
};

export type ExploreStackParamList = {
  Explore: undefined;
  CollectionDetail: { collectionId: string };
};

export type MainTabParamList = {
  홈: undefined;
  탐색: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="AddLink" component={AddLinkScreen} />
      <HomeStack.Screen name="Collections" component={CollectionsScreen} />
    </HomeStack.Navigator>
  );
}

function ExploreStackScreen() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStack.Screen name="Explore" component={ExploreScreen} />
      <ExploreStack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
    </ExploreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#F3F4F6',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: React.ComponentProps<typeof Ionicons>['name'];
          if (route.name === '홈') {
            iconName = focused ? 'bookmark' : 'bookmark-outline';
          } else {
            iconName = focused ? 'compass' : 'compass-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="홈" component={HomeStackScreen} />
      <Tab.Screen name="탐색" component={ExploreStackScreen} />
    </Tab.Navigator>
  );
}

function ShareHandler({ onShare }: { onShare: (url: string) => void }) {
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
  const navRef = useRef<NavigationContainerRef<MainTabParamList>>(null);

  useEffect(() => {
    if (session?.user.id) {
      registerForPushNotifications(session.user.id);
    }
  }, [session?.user.id]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = ExpoLinking.parse(url);
      if (parsed.scheme === 'clipu') {
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
        }}
        onCancel={() => setPendingInviteCode(null)}
      />
    </Modal>
  ) : null;

  if (!session) {
    return (
      <>
        <ShareHandler onShare={setSharedUrl} />
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
        <ShareHandler onShare={setSharedUrl} />
        <StatusBar style="light" />
        <SharePickerScreen
          sharedUrl={sharedUrl}
          userId={session.user.id}
          userNickname={session.user.user_metadata?.nickname || session.user.email?.split('@')[0] || ''}
          onDone={() => setSharedUrl(null)}
        />
        {inviteModal}
      </>
    );
  }

  return (
    <>
      <ShareHandler onShare={setSharedUrl} />
      <NavigationContainer ref={navRef}>
        <StatusBar style="auto" />
        <MainTabs />
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
