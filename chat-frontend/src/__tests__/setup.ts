// Setup file for Jest tests

// Mock react-native modules completely
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '15.0',
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  TextInput: (props: any) => props,
  TouchableOpacity: ({ children, onPress }: any) => ({
    children,
    onPress,
  }),
  FlatList: ({ data, renderItem }: any) => data?.map(renderItem),
  KeyboardAvoidingView: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  Alert: {
    alert: jest.fn(),
  },
  RefreshControl: (props: any) => props,
}))

// Mock Expo modules
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}))

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({
    params: {
      userName: 'TestUser',
      conversationId: 'conv1',
    },
  }),
  useFocusEffect: jest.fn(),
}))

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
  }),
}))

// Global test utils
global.fetch = jest.fn()

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
}

// Dummy test to prevent "no tests found" error
describe('Setup', () => {
  it('should setup test environment', () => {
    expect(true).toBe(true)
  })
})
