import { useEffect, useState, useCallback } from 'react';
import { socketService } from '../services/socketService';
import { MessageReaction } from '../../../chat-types/src';

export interface UseMessageReactionsProps {
  conversationId: string;
  userId: string;
  userName: string;
  isEnabled?: boolean;
}

export const useMessageReactions = ({
  conversationId,
  userId,
  userName,
  isEnabled = true,
}: UseMessageReactionsProps) => {
  const [reactions, setReactions] = useState<Map<string, MessageReaction[]>>(new Map());
  
  // Listen for reaction updates
  useEffect(() => {
    if (!isEnabled) return;
    
    const handleReactionAdded = (data: { messageId: string; reaction: MessageReaction }) => {
      console.log('Reaction added:', data);
      
      setReactions(prev => {
        const newMap = new Map(prev);
        const messageReactions = newMap.get(data.messageId) || [];
        
        // Check if user already reacted with this emoji
        const existingReaction = messageReactions.find(
          r => r.userId === data.reaction.userId && r.emoji === data.reaction.emoji
        );
        
        if (!existingReaction) {
          newMap.set(data.messageId, [...messageReactions, data.reaction]);
        }
        
        return newMap;
      });
    };
    
    const handleReactionRemoved = (data: { messageId: string; reactionId: string; userId: string }) => {
      console.log('Reaction removed:', data);
      
      setReactions(prev => {
        const newMap = new Map(prev);
        const messageReactions = newMap.get(data.messageId) || [];
        
        const updatedReactions = messageReactions.filter(
          r => r.id !== data.reactionId
        );
        
        if (updatedReactions.length > 0) {
          newMap.set(data.messageId, updatedReactions);
        } else {
          newMap.delete(data.messageId);
        }
        
        return newMap;
      });
    };
    
    socketService.onReactionAdded(handleReactionAdded);
    socketService.onReactionRemoved(handleReactionRemoved);
    
    return () => {
      socketService.offReactionAdded(handleReactionAdded);
      socketService.offReactionRemoved(handleReactionRemoved);
    };
  }, [isEnabled]);
  
  // Add a reaction to a message
  const addReaction = useCallback((messageId: string, emoji: string) => {
    if (!isEnabled || !socketService.isConnected()) {
      console.log('Cannot add reaction: enabled=', isEnabled, 'connected=', socketService.isConnected());
      return;
    }
    
    console.log('Adding reaction:', { messageId, emoji, userId, userName, conversationId });
    socketService.addReaction(messageId, conversationId, userId, userName, emoji);
  }, [conversationId, userId, userName, isEnabled]);
  
  // Remove a reaction from a message
  const removeReaction = useCallback((messageId: string, reactionId: string) => {
    if (!isEnabled || !socketService.isConnected()) return;
    
    socketService.removeReaction(messageId, conversationId, userId, reactionId);
  }, [conversationId, userId, isEnabled]);
  
  // Toggle a reaction (add if not present, remove if present, or replace if different emoji)
  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    if (!isEnabled || !socketService.isConnected()) {
      console.log('Cannot toggle reaction: enabled=', isEnabled, 'connected=', socketService.isConnected());
      return;
    }
    
    const messageReactions = reactions.get(messageId) || [];
    const existingUserReaction = messageReactions.find(r => r.userId === userId);
    
    console.log('Toggle reaction:', { messageId, emoji, existingUserReaction, totalReactions: messageReactions.length });
    
    if (existingUserReaction) {
      if (existingUserReaction.emoji === emoji) {
        // Same emoji - remove it (toggle off)
        console.log('Removing same emoji reaction');
        removeReaction(messageId, existingUserReaction.id);
      } else {
        // Different emoji - replace it (backend will handle the replacement)
        console.log('Replacing with different emoji');
        addReaction(messageId, emoji);
      }
    } else {
      // No existing reaction - add new one
      console.log('Adding new reaction');
      addReaction(messageId, emoji);
    }
  }, [reactions, userId, addReaction, removeReaction, isEnabled]);
  
  // Get reactions for a specific message
  const getMessageReactions = useCallback((messageId: string) => {
    return reactions.get(messageId) || [];
  }, [reactions]);
  
  // Get grouped reactions by emoji for a message
  const getGroupedReactions = useCallback((messageId: string) => {
    const messageReactions = reactions.get(messageId) || [];
    const grouped = new Map<string, MessageReaction[]>();
    
    messageReactions.forEach(reaction => {
      const existing = grouped.get(reaction.emoji) || [];
      grouped.set(reaction.emoji, [...existing, reaction]);
    });
    
    return grouped;
  }, [reactions]);
  
  // Get reaction summary for a message
  const getReactionSummary = useCallback((messageId: string) => {
    const grouped = getGroupedReactions(messageId);
    const summary: { emoji: string; count: number; users: string[]; hasCurrentUser: boolean }[] = [];
    
    grouped.forEach((reactions, emoji) => {
      const users = reactions.map(r => r.userName);
      const hasCurrentUser = reactions.some(r => r.userId === userId);
      
      summary.push({
        emoji,
        count: reactions.length,
        users,
        hasCurrentUser,
      });
    });
    
    // Sort by count descending
    return summary.sort((a, b) => b.count - a.count);
  }, [getGroupedReactions, userId]);
  
  // Check if current user has reacted with a specific emoji
  const hasUserReacted = useCallback((messageId: string, emoji: string) => {
    const messageReactions = reactions.get(messageId) || [];
    return messageReactions.some(r => r.userId === userId && r.emoji === emoji);
  }, [reactions, userId]);
  
  // Check if current user has reacted with any emoji to this message
  const hasUserReactedWithAny = useCallback((messageId: string) => {
    const messageReactions = reactions.get(messageId) || [];
    return messageReactions.some(r => r.userId === userId);
  }, [reactions, userId]);
  
  // Get the user's current reaction emoji (if any)
  const getUserReactionEmoji = useCallback((messageId: string) => {
    const messageReactions = reactions.get(messageId) || [];
    const userReaction = messageReactions.find(r => r.userId === userId);
    return userReaction?.emoji || null;
  }, [reactions, userId]);
  
  // Get total reaction count for a message
  const getTotalReactionCount = useCallback((messageId: string) => {
    const messageReactions = reactions.get(messageId) || [];
    return messageReactions.length;
  }, [reactions]);
  
  // Get reaction tooltip text
  const getReactionTooltip = useCallback((messageId: string, emoji: string) => {
    const messageReactions = reactions.get(messageId) || [];
    const emojiReactions = messageReactions.filter(r => r.emoji === emoji);
    
    if (emojiReactions.length === 0) return '';
    
    const users = emojiReactions.map(r => r.userName);
    
    if (users.length === 1) {
      return `${users[0]} reacted with ${emoji}`;
    } else if (users.length === 2) {
      return `${users[0]} and ${users[1]} reacted with ${emoji}`;
    } else {
      return `${users[0]} and ${users.length - 1} others reacted with ${emoji}`;
    }
  }, [reactions]);
  
  // Initialize reactions for existing messages
  const initializeReactions = useCallback((messageId: string, initialReactions: MessageReaction[]) => {
    setReactions(prev => {
      const newMap = new Map(prev);
      if (initialReactions.length > 0) {
        newMap.set(messageId, initialReactions);
      }
      return newMap;
    });
  }, []);
  
  // Clear all reactions (useful for cleanup)
  const clearAllReactions = useCallback(() => {
    setReactions(new Map());
  }, []);
  
  return {
    addReaction,
    removeReaction,
    toggleReaction,
    getMessageReactions,
    getGroupedReactions,
    getReactionSummary,
    hasUserReacted,
    hasUserReactedWithAny,
    getUserReactionEmoji,
    getTotalReactionCount,
    getReactionTooltip,
    initializeReactions,
    clearAllReactions,
    isConnected: socketService.isConnected(),
  };
};