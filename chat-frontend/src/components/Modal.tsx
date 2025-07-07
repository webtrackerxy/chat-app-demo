import React from 'react';
import { Modal as RNModal, View, Text, StyleSheet, ModalProps } from 'react-native';
import { Button } from './Button';
import { Input } from './Input';

interface ActionModalProps extends Omit<ModalProps, 'children'> {
  title: string;
  inputValue?: string;
  onInputChange?: (text: string) => void;
  inputPlaceholder?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  showInput?: boolean;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  title,
  inputValue = '',
  onInputChange,
  inputPlaceholder = '',
  onCancel,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showInput = true,
  ...modalProps
}) => {
  return (
    <RNModal
      transparent
      animationType="slide"
      {...modalProps}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          
          {showInput && (
            <Input
              style={styles.input}
              value={inputValue}
              onChangeText={onInputChange}
              placeholder={inputPlaceholder}
              autoFocus
            />
          )}
          
          <View style={styles.buttons}>
            <Button
              title={cancelText}
              onPress={onCancel}
              variant="secondary"
              style={styles.button}
            />
            <Button
              title={confirmText}
              onPress={onConfirm}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: '80%',
    maxWidth: 300,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
});