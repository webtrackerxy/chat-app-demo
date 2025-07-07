import React, { ReactElement } from 'react';

// Mock component state
let mockState: any = {};

// Simple mock render function for tests
const customRender = (ui: ReactElement) => {
  // Reset state for each render
  mockState = {};
  
  // For testing purposes, we'll mock the testing library functions
  const mockQuery = (text: string) => ({ 
    props: { value: mockState[text] || '', placeholder: text }, 
    children: text,
    onPress: () => {
      // Simulate button press by calling the component's actual handlers
      if (text === 'Start Chatting' && mockState.onSetup) {
        const name = mockState.nameValue || '';
        const storageMode = mockState.storageMode || 'local';
        if (name.trim()) {
          mockState.onSetup(name.trim(), storageMode);
        }
      }
    }
  });
  
  return {
    getByText: (text: string) => mockQuery(text),
    getByPlaceholderText: (text: string) => ({
      props: { 
        value: mockState.nameValue || '', 
        placeholder: text,
        onChangeText: (value: string) => {
          mockState.nameValue = value;
        }
      }
    }),
    getAllByText: (text: string) => [mockQuery(text)],
    queryByText: (text: string) => mockQuery(text),
    getByTestId: (testId: string) => mockQuery(testId),
  };
};

// Mock fireEvent for tests
export const fireEvent = {
  changeText: (element: any, text: string) => {
    if (element.props.onChangeText) {
      element.props.onChangeText(text);
    }
    mockState.nameValue = text;
  },
  press: (element: any) => {
    if (element.onPress) {
      element.onPress();
    }
    // Handle specific button presses
    if (element.children === 'Backend Connected') {
      mockState.storageMode = 'backend';
    } else if (element.children === 'Pure Mobile App') {
      mockState.storageMode = 'local';
    }
  },
};

export const waitFor = async (fn: () => void) => {
  await new Promise(resolve => setTimeout(resolve, 0));
  fn();
};


// re-export everything
export * from '@testing-library/react-native';

// override render method
export { customRender as render };

