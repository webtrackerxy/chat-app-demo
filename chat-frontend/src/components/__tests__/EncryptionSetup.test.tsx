/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { EncryptionSetup } from '../EncryptionSetup'
import { useEncryption } from '@hooks/useEncryption'

// Mock the useEncryption hook
jest.mock('@hooks/useEncryption', () => ({
  useEncryption: jest.fn(),
}))

// Mock useTheme
jest.mock('@theme', () => ({
  useTheme: () => ({
    colors: {
      semantic: {
        background: { primary: '#FFFFFF', secondary: '#F5F5F5' },
        text: { primary: '#000000', secondary: '#666666', tertiary: '#999999' },
        border: { primary: '#E0E0E0' },
        surface: { primary: '#FFFFFF', secondary: '#F5F5F5' },
      },
      primary: { 500: '#007AFF' },
      white: '#FFFFFF',
      warning: { 50: '#FFF3CD', 700: '#856404' },
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    typography: {
      heading: { 3: { fontSize: 20, fontWeight: 'bold' } },
      body: { medium: { fontSize: 16 }, small: { fontSize: 14 } },
    },
  }),
}))

// Mock Alert
jest.spyOn(Alert, 'alert')

const mockUseEncryption = useEncryption as jest.MockedFunction<typeof useEncryption>

describe('EncryptionSetup', () => {
  const mockProps = {
    userId: 'test-user-123',
    visible: true,
    onClose: jest.fn(),
    onComplete: jest.fn(),
  }

  const mockEncryptionHook = {
    generateKeys: jest.fn(),
    loadKeys: jest.fn(),
    isGeneratingKeys: false,
    isLoadingKeys: false,
    error: null,
    clearError: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseEncryption.mockReturnValue(mockEncryptionHook as any)
  })

  describe('Rendering', () => {
    test('should render correctly when visible', () => {
      render(<EncryptionSetup {...mockProps} />)

      expect(screen.getByText('🔐 Message Encryption')).toBeTruthy()
      expect(screen.getByText('Secure your messages with end-to-end encryption')).toBeTruthy()
      expect(screen.getByText('Generate New Keys')).toBeTruthy()
      expect(screen.getByText('Load Existing Keys')).toBeTruthy()
    })

    test('should not render when not visible', () => {
      render(<EncryptionSetup {...mockProps} visible={false} />)

      expect(screen.queryByText('🔐 Message Encryption')).toBeNull()
    })

    test('should show password fields in generate mode', () => {
      render(<EncryptionSetup {...mockProps} />)

      expect(screen.getByPlaceholderText('Enter a strong password')).toBeTruthy()
      expect(screen.getByPlaceholderText('Confirm your password')).toBeTruthy()
      expect(screen.getByText('Generate Keys')).toBeTruthy()
    })

    test('should show single password field in load mode', () => {
      render(<EncryptionSetup {...mockProps} />)

      // Switch to load mode
      fireEvent.press(screen.getByText('Load Existing Keys'))

      expect(screen.getByPlaceholderText('Enter a strong password')).toBeTruthy()
      expect(screen.queryByPlaceholderText('Confirm your password')).toBeNull()
      expect(screen.getByText('Load Keys')).toBeTruthy()
    })
  })

  describe('Mode Switching', () => {
    test('should switch between generate and load modes', () => {
      render(<EncryptionSetup {...mockProps} />)

      // Initially in generate mode
      expect(screen.getByText('Generate Keys')).toBeTruthy()

      // Switch to load mode
      fireEvent.press(screen.getByText('Load Existing Keys'))
      expect(screen.getByText('Load Keys')).toBeTruthy()

      // Switch back to generate mode
      fireEvent.press(screen.getByText('Generate New Keys'))
      expect(screen.getByText('Generate Keys')).toBeTruthy()
    })

    test('should clear form when switching modes', () => {
      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')

      // Enter some text
      fireEvent.changeText(passwordInput, 'test-password')
      fireEvent.changeText(confirmPasswordInput, 'test-password')

      // Switch mode
      fireEvent.press(screen.getByText('Load Existing Keys'))
      fireEvent.press(screen.getByText('Generate New Keys'))

      // Fields should be cleared
      expect(passwordInput.props.value).toBe('')
      expect(confirmPasswordInput.props.value).toBe('')
    })
  })

  describe('Form Validation', () => {
    test('should validate password match in generate mode', () => {
      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')
      const generateButton = screen.getByText('Generate Keys')

      fireEvent.changeText(passwordInput, 'password123')
      fireEvent.changeText(confirmPasswordInput, 'different-password')
      fireEvent.press(generateButton)

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Passwords do not match')
      expect(mockEncryptionHook.generateKeys).not.toHaveBeenCalled()
    })

    test('should validate password length', () => {
      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')
      const generateButton = screen.getByText('Generate Keys')

      fireEvent.changeText(passwordInput, 'short')
      fireEvent.changeText(confirmPasswordInput, 'short')
      fireEvent.press(generateButton)

      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Password must be at least 8 characters long',
      )
      expect(mockEncryptionHook.generateKeys).not.toHaveBeenCalled()
    })

    test('should require password in load mode', () => {
      render(<EncryptionSetup {...mockProps} />)

      // Switch to load mode
      fireEvent.press(screen.getByText('Load Existing Keys'))

      const loadButton = screen.getByText('Load Keys')
      fireEvent.press(loadButton)

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter your password')
      expect(mockEncryptionHook.loadKeys).not.toHaveBeenCalled()
    })
  })

  describe('Key Generation', () => {
    test('should generate keys successfully', async () => {
      mockEncryptionHook.generateKeys.mockResolvedValue(true)

      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')
      const generateButton = screen.getByText('Generate Keys')

      fireEvent.changeText(passwordInput, 'strongpassword123')
      fireEvent.changeText(confirmPasswordInput, 'strongpassword123')
      fireEvent.press(generateButton)

      expect(mockEncryptionHook.generateKeys).toHaveBeenCalledWith(
        'test-user-123',
        'strongpassword123',
      )

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Encryption keys generated successfully!',
          [{ text: 'OK', onPress: mockProps.onComplete }],
        )
      })
    })

    test('should handle key generation failure', async () => {
      const errorMessage = 'Key generation failed'
      mockEncryptionHook.generateKeys.mockResolvedValue(false)
      mockEncryptionHook.error = errorMessage

      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')
      const generateButton = screen.getByText('Generate Keys')

      fireEvent.changeText(passwordInput, 'strongpassword123')
      fireEvent.changeText(confirmPasswordInput, 'strongpassword123')
      fireEvent.press(generateButton)

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', errorMessage)
      })
    })

    test('should show loading state during generation', () => {
      mockEncryptionHook.isGeneratingKeys = true

      render(<EncryptionSetup {...mockProps} />)

      const generateButton = screen.getByText('Processing...')
      expect(generateButton.props.accessibilityState.disabled).toBe(true)
    })
  })

  describe('Key Loading', () => {
    test('should load keys successfully', async () => {
      mockEncryptionHook.loadKeys.mockResolvedValue(true)

      render(<EncryptionSetup {...mockProps} />)

      // Switch to load mode
      fireEvent.press(screen.getByText('Load Existing Keys'))

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const loadButton = screen.getByText('Load Keys')

      fireEvent.changeText(passwordInput, 'mypassword123')
      fireEvent.press(loadButton)

      expect(mockEncryptionHook.loadKeys).toHaveBeenCalledWith('mypassword123')

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Encryption keys loaded successfully!',
          [{ text: 'OK', onPress: mockProps.onComplete }],
        )
      })
    })

    test('should handle key loading failure', async () => {
      const errorMessage = 'Invalid password'
      mockEncryptionHook.loadKeys.mockResolvedValue(false)
      mockEncryptionHook.error = errorMessage

      render(<EncryptionSetup {...mockProps} />)

      // Switch to load mode
      fireEvent.press(screen.getByText('Load Existing Keys'))

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const loadButton = screen.getByText('Load Keys')

      fireEvent.changeText(passwordInput, 'wrongpassword')
      fireEvent.press(loadButton)

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', errorMessage)
      })
    })

    test('should show loading state during key loading', () => {
      mockEncryptionHook.isLoadingKeys = true

      render(<EncryptionSetup {...mockProps} />)

      // Switch to load mode
      fireEvent.press(screen.getByText('Load Existing Keys'))

      const loadButton = screen.getByText('Processing...')
      expect(loadButton.props.accessibilityState.disabled).toBe(true)
    })
  })

  describe('Modal Behavior', () => {
    test('should call onClose when cancel is pressed', () => {
      render(<EncryptionSetup {...mockProps} />)

      const cancelButton = screen.getByText('Cancel')
      fireEvent.press(cancelButton)

      expect(mockProps.onClose).toHaveBeenCalled()
      expect(mockEncryptionHook.clearError).toHaveBeenCalled()
    })

    test('should clear form data when modal closes', () => {
      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')

      // Enter some data
      fireEvent.changeText(passwordInput, 'test-password')
      fireEvent.changeText(confirmPasswordInput, 'test-password')

      // Close modal
      const cancelButton = screen.getByText('Cancel')
      fireEvent.press(cancelButton)

      // Reopen modal
      render(<EncryptionSetup {...mockProps} />)

      // Fields should be empty
      expect(screen.getByPlaceholderText('Enter a strong password').props.value).toBe('')
      expect(screen.getByPlaceholderText('Confirm your password').props.value).toBe('')
    })

    test('should handle modal close request', () => {
      const { getByTestId } = render(<EncryptionSetup {...mockProps} />)

      // Simulate Android back button or gesture
      const modal = getByTestId('encryption-setup-modal') || screen.getByRole('dialog')
      fireEvent(modal, 'requestClose')

      expect(mockProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    test('should have proper accessibility labels', () => {
      render(<EncryptionSetup {...mockProps} />)

      expect(screen.getByPlaceholderText('Enter a strong password')).toBeTruthy()
      expect(screen.getByPlaceholderText('Confirm your password')).toBeTruthy()
      expect(screen.getByText('Generate Keys')).toBeTruthy()
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    test('should support secure text entry for passwords', () => {
      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')

      expect(passwordInput.props.secureTextEntry).toBe(true)
      expect(confirmPasswordInput.props.secureTextEntry).toBe(true)
    })

    test('should disable auto-capitalization for passwords', () => {
      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      expect(passwordInput.props.autoCapitalize).toBe('none')
    })
  })

  describe('Error Handling', () => {
    test('should display error messages from hook', () => {
      const errorMessage = 'Network connection failed'
      mockEncryptionHook.error = errorMessage

      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password')
      const generateButton = screen.getByText('Generate Keys')

      fireEvent.changeText(passwordInput, 'strongpassword123')
      fireEvent.changeText(confirmPasswordInput, 'strongpassword123')
      fireEvent.press(generateButton)

      // Error should be shown in alert
      expect(Alert.alert).toHaveBeenCalledWith('Error', errorMessage)
    })

    test('should clear errors when form is reset', () => {
      render(<EncryptionSetup {...mockProps} />)

      const cancelButton = screen.getByText('Cancel')
      fireEvent.press(cancelButton)

      expect(mockEncryptionHook.clearError).toHaveBeenCalled()
    })
  })

  describe('Form Reset', () => {
    test('should reset form when switching between modes', () => {
      render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      fireEvent.changeText(passwordInput, 'test-password')

      // Switch to load mode
      fireEvent.press(screen.getByText('Load Existing Keys'))

      // Switch back to generate mode
      fireEvent.press(screen.getByText('Generate New Keys'))

      // Password should be cleared
      expect(passwordInput.props.value).toBe('')
    })

    test('should reset form on modal close', () => {
      const { rerender } = render(<EncryptionSetup {...mockProps} />)

      const passwordInput = screen.getByPlaceholderText('Enter a strong password')
      fireEvent.changeText(passwordInput, 'test-password')

      // Close modal
      rerender(<EncryptionSetup {...mockProps} visible={false} />)

      // Reopen modal
      rerender(<EncryptionSetup {...mockProps} visible={true} />)

      // Form should be reset
      expect(screen.getByPlaceholderText('Enter a strong password').props.value).toBe('')
    })
  })
})
