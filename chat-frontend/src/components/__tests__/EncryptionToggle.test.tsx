/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native'
import { EncryptionToggle } from '../EncryptionToggle'
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
        background: { primary: '#FFFFFF' },
        text: { primary: '#000000', secondary: '#666666' },
        border: { primary: '#E0E0E0' },
        surface: { primary: '#FFFFFF', secondary: '#F5F5F5' },
      },
      primary: { 500: '#007AFF' },
      success: { 50: '#D4EDDA', 200: '#C3E6CB', 500: '#28A745' },
      base: { white: '#FFFFFF' },
    },
    spacing: { xs: 4, sm: 8, md: 16 },
    typography: {
      body: {
        m: { regular: { fontSize: 16 } },
        s: { regular: { fontSize: 14 } },
      },
    },
  }),
}))

const mockUseEncryption = useEncryption as jest.MockedFunction<typeof useEncryption>

describe('EncryptionToggle', () => {
  const mockProps = {
    conversationId: 'conv-123',
    userId: 'user-123',
    onEncryptionChange: jest.fn(),
  }

  const mockEncryptionHook = {
    isEncryptionEnabled: jest.fn(),
    enableEncryption: jest.fn(),
    hasKeys: true,
    keysLoaded: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseEncryption.mockReturnValue(mockEncryptionHook as any)
  })

  describe('Rendering', () => {
    test('should render when user has keys', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('🔐 End-to-End Encryption')).toBeTruthy()
        expect(screen.getByText('Enable to secure messages with encryption')).toBeTruthy()
      })
    })

    test('should not render when user has no keys', () => {
      mockEncryptionHook.hasKeys = false

      const { toJSON } = render(<EncryptionToggle {...mockProps} />)

      expect(toJSON()).toBeNull()
    })

    test('should not render when keys are not loaded', () => {
      mockEncryptionHook.keysLoaded = false

      const { toJSON } = render(<EncryptionToggle {...mockProps} />)

      expect(toJSON()).toBeNull()
    })
  })

  describe('Encryption Status', () => {
    test('should show inactive state when encryption is disabled', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Enable to secure messages with encryption')).toBeTruthy()
        expect(screen.queryByText('ACTIVE')).toBeNull()
      })
    })

    test('should show active state when encryption is enabled', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(true)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Messages are protected with end-to-end encryption')).toBeTruthy()
        expect(screen.getByText('ACTIVE')).toBeTruthy()
      })

      expect(mockProps.onEncryptionChange).toHaveBeenCalledWith(true)
    })

    test('should check encryption status on mount', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(mockEncryptionHook.isEncryptionEnabled).toHaveBeenCalledWith('conv-123', 'user-123')
      })
    })

    test('should update status when props change', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      const { rerender } = render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(mockEncryptionHook.isEncryptionEnabled).toHaveBeenCalledWith('conv-123', 'user-123')
      })

      // Change conversation ID
      rerender(<EncryptionToggle {...mockProps} conversationId='conv-456' />)

      await waitFor(() => {
        expect(mockEncryptionHook.isEncryptionEnabled).toHaveBeenCalledWith('conv-456', 'user-123')
      })
    })
  })

  describe('Toggle Interaction', () => {
    test('should enable encryption when toggled on', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)
      mockEncryptionHook.enableEncryption.mockResolvedValue(undefined)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Enable to secure messages with encryption')).toBeTruthy()
      })

      const toggle = screen.getByRole('switch')
      fireEvent(toggle, 'valueChange', true)

      await waitFor(() => {
        expect(mockEncryptionHook.enableEncryption).toHaveBeenCalledWith('conv-123')
      })

      expect(mockProps.onEncryptionChange).toHaveBeenCalledWith(true)
    })

    test('should not allow disabling encryption once enabled', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(true)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const toggle = screen.getByRole('switch')
        expect(toggle.props.disabled).toBe(true)
      })
    })

    test('should show loading state during enable operation', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      let resolveEnable: () => void
      const enablePromise = new Promise<void>((resolve) => {
        resolveEnable = resolve
      })
      mockEncryptionHook.enableEncryption.mockReturnValue(enablePromise)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const toggle = screen.getByRole('switch')
        fireEvent(toggle, 'valueChange', true)
      })

      // Should be disabled during loading
      const toggle = screen.getByRole('switch')
      expect(toggle.props.disabled).toBe(true)

      // Complete the operation
      resolveEnable!()
      await enablePromise
    })

    test('should handle enable encryption errors', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)
      mockEncryptionHook.enableEncryption.mockRejectedValue(new Error('Enable failed'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const toggle = screen.getByRole('switch')
        fireEvent(toggle, 'valueChange', true)
      })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to toggle encryption:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Visual States', () => {
    test('should apply correct styling for inactive state', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const container = screen.getByText('🔐 End-to-End Encryption').parent

        // Should have neutral styling for inactive state
        expect(container?.props.style).toMatchObject({
          backgroundColor: '#F5F5F5', // semantic.surface.secondary
          borderColor: '#E0E0E0', // semantic.border.primary
        })
      })
    })

    test('should apply correct styling for active state', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(true)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const container = screen.getByText('🔐 End-to-End Encryption').parent

        // Should have success styling for active state
        expect(container?.props.style).toMatchObject({
          backgroundColor: '#D4EDDA', // success[50]
          borderColor: '#C3E6CB', // success[200]
        })
      })
    })

    test('should show active badge when encryption is enabled', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(true)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const activeBadge = screen.getByText('ACTIVE')
        expect(activeBadge).toBeTruthy()

        const badgeContainer = activeBadge.parent
        expect(badgeContainer?.props.style).toMatchObject({
          backgroundColor: '#28A745', // success[500]
        })
      })
    })
  })

  describe('Switch Component', () => {
    test('should configure switch correctly for inactive state', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const toggle = screen.getByRole('switch')

        expect(toggle.props.value).toBe(false)
        expect(toggle.props.disabled).toBe(false)
        expect(toggle.props.trackColor).toEqual({
          false: '#E0E0E0', // semantic.border.primary
          true: '#28A745', // success[500]
        })
        expect(toggle.props.thumbColor).toBe('#FFFFFF') // white
      })
    })

    test('should configure switch correctly for active state', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(true)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const toggle = screen.getByRole('switch')

        expect(toggle.props.value).toBe(true)
        expect(toggle.props.disabled).toBe(true) // Can't disable once enabled
      })
    })
  })

  describe('Accessibility', () => {
    test('should have proper accessibility properties', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        const toggle = screen.getByRole('switch')
        expect(toggle).toBeTruthy()
      })
    })

    test('should have readable labels', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('🔐 End-to-End Encryption')).toBeTruthy()
        expect(screen.getByText('Enable to secure messages with encryption')).toBeTruthy()
      })
    })

    test('should provide feedback for screen readers', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(true)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Messages are protected with end-to-end encryption')).toBeTruthy()
      })
    })
  })

  describe('Props Handling', () => {
    test('should call onEncryptionChange with current status', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(true)

      render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(mockProps.onEncryptionChange).toHaveBeenCalledWith(true)
      })
    })

    test('should handle different conversation IDs', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      const { rerender } = render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(mockEncryptionHook.isEncryptionEnabled).toHaveBeenCalledWith('conv-123', 'user-123')
      })

      // Change conversation
      const newProps = { ...mockProps, conversationId: 'conv-456' }
      rerender(<EncryptionToggle {...newProps} />)

      await waitFor(() => {
        expect(mockEncryptionHook.isEncryptionEnabled).toHaveBeenCalledWith('conv-456', 'user-123')
      })
    })

    test('should handle different user IDs', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockResolvedValue(false)

      const { rerender } = render(<EncryptionToggle {...mockProps} />)

      await waitFor(() => {
        expect(mockEncryptionHook.isEncryptionEnabled).toHaveBeenCalledWith('conv-123', 'user-123')
      })

      // Change user
      const newProps = { ...mockProps, userId: 'user-456' }
      rerender(<EncryptionToggle {...newProps} />)

      await waitFor(() => {
        expect(mockEncryptionHook.isEncryptionEnabled).toHaveBeenCalledWith('conv-123', 'user-456')
      })
    })
  })

  describe('Error Recovery', () => {
    test('should handle isEncryptionEnabled errors gracefully', async () => {
      mockEncryptionHook.isEncryptionEnabled.mockRejectedValue(new Error('Check failed'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<EncryptionToggle {...mockProps} />)

      // Should not crash and should render nothing
      await waitFor(() => {
        expect(screen.queryByText('🔐 End-to-End Encryption')).toBeNull()
      })

      consoleSpy.mockRestore()
    })

    test('should recover from temporary errors', async () => {
      // First call fails
      mockEncryptionHook.isEncryptionEnabled
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(false)

      const { rerender } = render(<EncryptionToggle {...mockProps} />)

      // Should handle error gracefully
      await waitFor(() => {
        expect(screen.queryByText('🔐 End-to-End Encryption')).toBeNull()
      })

      // Retry with props change
      rerender(<EncryptionToggle {...mockProps} conversationId='conv-456' />)

      // Should work on retry
      await waitFor(() => {
        expect(screen.getByText('🔐 End-to-End Encryption')).toBeTruthy()
      })
    })
  })
})
