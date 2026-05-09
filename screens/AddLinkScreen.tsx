import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppStackParamList } from '../App';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'AddLink'>;
};

export default function AddLinkScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('오류', 'URL을 입력해주세요.');
      return;
    }
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;

    setLoading(true);
    const { error } = await supabase.from('links').insert({
      user_id: session!.user.id,
      url: normalized,
    });
    setLoading(false);

    if (error) {
      Alert.alert('저장 실패', error.message);
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>링크 저장</Text>
        <Text style={styles.subtitle}>저장할 URL을 붙여넣으세요</Text>

        <TextInput
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor="#999"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          autoFocus
        />

        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>저장</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>취소</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 16,
    color: '#111',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancel: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
  },
});
