import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { NameInputScreen } from './src/screens/NameInputScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { ChatRoomScreen } from './src/screens/ChatRoomScreen';

export type RootStackParamList = {
  NameInput: undefined;
  ChatList: { userName: string };
  ChatRoom: { userName: string; conversationId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigation = () => (
  <NavigationContainer>
    <Stack.Navigator 
      initialRouteName="NameInput"
      screenOptions={{
        headerShown: false, 
      }}
    >
      <Stack.Screen 
        name="NameInput" 
        component={NameInputScreen} 
      />
      <Stack.Screen 
        name="ChatList" 
        component={ChatListScreen} 
      />
      <Stack.Screen 
        name="ChatRoom" 
        component={ChatRoomScreen} 
      />
    </Stack.Navigator>
    <StatusBar style="auto" />
  </NavigationContainer>
);

export default function App() {
  return <AppNavigation />;
}
