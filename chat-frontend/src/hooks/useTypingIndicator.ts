import { useEffect, useState, useCallback, useRef } from 'react';
import { socketService } from '../services/socketService';

export interface UseTypingIndicatorProps {
  conversationId: string;
  currentUserId: string;
  isEnabled?: boolean;
}

export const useTypingIndicator = ({
  conversationId,
  currentUserId,
  isEnabled = true,
}: UseTypingIndicatorProps) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  
  // Listen for typing events
  useEffect(() => {
    if (!isEnabled) return;
    
    const handleUserTyping = (data: { userId: string; userName: string }) => {
      if (data.userId !== currentUserId) {
        setTypingUsers(prev => {
          // Remove user if already in list, then add them
          const filtered = prev.filter(userName => userName !== data.userName);
          return [...filtered, data.userName];
        });
        
        // Auto-remove typing status after 3 seconds of no activity
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(userName => userName !== data.userName));
        }, 3000);
      }
    };
    
    const handleUserStoppedTyping = (data: { userId: string }) => {
      if (data.userId !== currentUserId) {
        // We can't remove by userId since we only store userNames
        // The timeout in handleUserTyping will handle cleanup
      }
    };
    
    socketService.onUserTyping(handleUserTyping);
    socketService.onUserStoppedTyping(handleUserStoppedTyping);
    
    return () => {
      socketService.offUserTyping(handleUserTyping);
      socketService.offUserStoppedTyping(handleUserStoppedTyping);
    };
  }, [conversationId, currentUserId, isEnabled]);
  
  // Start typing function
  const startTyping = useCallback((userId: string, userName: string) => {
    if (!isEnabled || !socketService.isConnected()) return;
    
    // Only emit if not already typing
    if (!isTypingRef.current) {
      socketService.startTyping(conversationId, userId, userName);
      isTypingRef.current = true;
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(userId);
    }, 1000);
  }, [conversationId, isEnabled]);
  
  // Stop typing function
  const stopTyping = useCallback((userId: string) => {
    if (!isEnabled || !socketService.isConnected()) return;
    
    if (isTypingRef.current) {
      socketService.stopTyping(conversationId, userId);
      isTypingRef.current = false;
    }
    
    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [conversationId, isEnabled]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  
  // Format typing display text
  const getTypingText = useCallback(() => {
    if (typingUsers.length === 0) return '';
    
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    } else {
      return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
    }
  }, [typingUsers]);
  
  return {
    typingUsers,
    startTyping,
    stopTyping,
    getTypingText,
    isAnyoneTyping: typingUsers.length > 0,
  };
};