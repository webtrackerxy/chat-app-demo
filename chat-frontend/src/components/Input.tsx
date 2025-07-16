import React from 'react'
import { TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native'

interface InputProps extends TextInputProps {
  variant?: 'default' | 'rounded' | 'centered'
  size?: 'small' | 'medium' | 'large'
  style?: ViewStyle
}

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  size = 'medium',
  style,
  ...props
}) => {
  return <TextInput style={[styles.input, styles[variant], styles[size], style]} {...props} />
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    backgroundColor: '#fff',
  },
  // Variants
  default: {
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  rounded: {
    borderRadius: 25,
    paddingHorizontal: 20,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  centered: {
    textAlign: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  // Sizes
  small: {
    height: 36,
    fontSize: 14,
  },
  medium: {
    height: 44,
    fontSize: 16,
  },
  large: {
    height: 52,
    fontSize: 18,
  },
})
