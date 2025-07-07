import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button, Input, StorageModeSelector } from '../components';
import { useChat } from '../hooks/useChat';
import { RootStackParamList } from '../../App';

export type StorageMode = 'local' | 'backend';

type NameInputScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NameInput'>;

export const NameInputScreen: React.FC = () => {
  const navigation = useNavigation<NameInputScreenNavigationProp>();
  const { setStorageMode, setCurrentUser } = useChat();
  const [name, setName] = useState('');
  const [selectedMode, setSelectedMode] = useState<StorageMode | null>(null);

  const handleSubmit = () => {
    if (name.trim() && selectedMode) {
      setStorageMode(selectedMode);
      setCurrentUser({ 
        id: `user-${Date.now()}`, 
        name: name.trim() 
      });
      navigation.navigate('ChatList', { userName: name.trim() });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Chat App</Text>
        <Text style={styles.subtitle}>Please enter your name and choose storage mode</Text>
        
        <Input
          variant="rounded"
          size="large"
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.nameInput}
        />
        
        <StorageModeSelector
          selectedMode={selectedMode}
          onModeSelect={setSelectedMode}
        />
        
        <Button
          title="Start Chatting"
          onPress={handleSubmit}
          disabled={!name.trim() || !selectedMode}
          size="large"
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  nameInput: {
    width: '100%',
    marginBottom: 24,
  },
  continueButton: {
    marginTop: 16,
    minWidth: 200,
  },
});