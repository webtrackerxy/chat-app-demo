import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { NameInputScreen } from '@screens/NameInputScreen'
import { ChatListScreen } from '@screens/ChatListScreen'
import { ChatRoomScreen } from '@screens/ChatRoomScreen'
import { RootStackParamList } from '@types'
import { ThemeProvider, useTheme } from '@theme'

const Stack = createStackNavigator<RootStackParamList>()

const AppNavigation = () => {
  let themeContext
  try {
    themeContext = useTheme()
  } catch (error) {
    console.error('AppNavigation - Theme context error:', error)
    // Fallback to default theme
    themeContext = { isDark: false }
  }
  
  const { isDark } = themeContext
  
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName='NameInput'
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name='NameInput' component={NameInputScreen} />
        <Stack.Screen name='ChatList' component={ChatListScreen} />
        <Stack.Screen name='ChatRoom' component={ChatRoomScreen} />
      </Stack.Navigator>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  )
}

export default function App() {
  console.log('App component rendering')
  console.log('ThemeProvider:', ThemeProvider)
  
  return (
    <ThemeProvider defaultMode="light">
      <AppNavigation />
    </ThemeProvider>
  )
}
