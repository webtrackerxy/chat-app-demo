import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lightColors, darkColors, createSemanticColors, type ColorScheme } from './colors'
import { typography, spacing, borderRadius, shadows } from './tokens'

export type ThemeMode = 'light' | 'dark'

export interface ThemeContextType {
  mode: ThemeMode
  toggleMode: () => void
  setMode: (mode: ThemeMode) => void
  colors: ColorScheme & { semantic: ReturnType<typeof createSemanticColors> }
  typography: typeof typography
  spacing: typeof spacing
  borderRadius: typeof borderRadius
  shadows: typeof shadows
  isDark: boolean
  isLight: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = '@chat_app_theme_mode'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultMode?: ThemeMode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = (props) => {
  console.log('ThemeProvider called with props:', props)

  // Safe prop extraction with fallbacks
  const children = props?.children || null
  const defaultMode = props?.defaultMode || 'light'

  // State initialization
  const [mode, setModeState] = useState<ThemeMode>(defaultMode)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load saved theme from storage on app start
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY)
        if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
          setModeState(savedMode)
        }
      } catch (error) {
        console.warn('Failed to load theme from storage:', error)
      } finally {
        setIsLoaded(true)
      }
    }

    loadSavedTheme()
  }, [])

  // Save theme to storage when it changes
  const setMode = async (newMode: ThemeMode) => {
    try {
      setModeState(newMode)
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode)
    } catch (error) {
      console.warn('Failed to save theme to storage:', error)
    }
  }

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
  }

  // Get current color scheme based on mode
  const currentColors = mode === 'dark' ? darkColors : lightColors
  const semanticColors = createSemanticColors(currentColors)

  const themeValue: ThemeContextType = {
    mode,
    toggleMode,
    setMode,
    colors: {
      ...currentColors,
      semantic: semanticColors,
    },
    typography,
    spacing,
    borderRadius,
    shadows,
    isDark: mode === 'dark',
    isLight: mode === 'light',
  }

  // Always provide the theme context, even during loading
  return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Hook for just getting the current theme mode
export const useThemeMode = () => {
  const { mode, toggleMode, setMode, isDark, isLight } = useTheme()
  return { mode, toggleMode, setMode, isDark, isLight }
}
