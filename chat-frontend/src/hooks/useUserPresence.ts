import { useEffect, useState, useCallback } from 'react';
import { socketService } from '../services/socketService';
import { UserPresence, UserPresenceUpdate } from '../../../chat-types/src';

export interface UseUserPresenceProps {
  conversationId: string;
  userId: string;
  userName: string;
  isEnabled?: boolean;
}

export const useUserPresence = ({
  conversationId,
  userId,
  userName,
  isEnabled = true,
}: UseUserPresenceProps) => {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, UserPresence>>(new Map());
  const [isCurrentUserOnline, setIsCurrentUserOnline] = useState(false);
  
  // Set current user as online when component mounts
  useEffect(() => {
    if (!isEnabled || !socketService.isConnected()) return;
    
    const setOnline = () => {
      socketService.setUserOnline(userId, userName, conversationId);
      setIsCurrentUserOnline(true);
    };
    
    // Set user as online immediately if already connected
    if (socketService.isConnected()) {
      setOnline();
    }
    
    // Listen for connection events
    socketService.onConnect(setOnline);
    
    socketService.onDisconnect(() => {
      setIsCurrentUserOnline(false);
    });
    
    return () => {
      socketService.offConnect(setOnline);
    };
  }, [conversationId, userId, userName, isEnabled]);
  
  // Listen for user presence updates
  useEffect(() => {
    if (!isEnabled) return;
    
    const handlePresenceUpdate = (data: UserPresenceUpdate) => {
      console.log('User presence update:', data);
      
      setOnlineUsers(prev => {
        const newMap = new Map(prev);
        
        const userPresence: UserPresence = {
          userId: data.userId,
          userName: data.userName,
          isOnline: data.isOnline,
          lastSeen: data.isOnline ? undefined : new Date(),
          conversationId: data.conversationId,
        };
        
        if (data.isOnline) {
          newMap.set(data.userId, userPresence);
        } else {
          // Keep offline users for a while to show "last seen"
          const existingUser = newMap.get(data.userId);
          if (existingUser) {
            newMap.set(data.userId, {
              ...existingUser,
              isOnline: false,
              lastSeen: new Date(),
            });
          }
        }
        
        return newMap;
      });
    };
    
    socketService.onUserPresenceUpdate(handlePresenceUpdate);
    
    return () => {
      socketService.offUserPresenceUpdate(handlePresenceUpdate);
    };
  }, [isEnabled]);
  
  // Get online users list
  const getOnlineUsers = useCallback(() => {
    return Array.from(onlineUsers.values()).filter(user => 
      user.isOnline && user.userId !== userId
    );
  }, [onlineUsers, userId]);
  
  // Get offline users list
  const getOfflineUsers = useCallback(() => {
    return Array.from(onlineUsers.values()).filter(user => 
      !user.isOnline && user.userId !== userId
    );
  }, [onlineUsers, userId]);
  
  // Check if a specific user is online
  const isUserOnline = useCallback((targetUserId: string) => {
    const user = onlineUsers.get(targetUserId);
    return user?.isOnline || false;
  }, [onlineUsers]);
  
  // Get user's last seen time
  const getLastSeen = useCallback((targetUserId: string) => {
    const user = onlineUsers.get(targetUserId);
    return user?.lastSeen;
  }, [onlineUsers]);
  
  // Get presence status text for a user
  const getPresenceText = useCallback((targetUserId: string) => {
    const user = onlineUsers.get(targetUserId);
    
    if (!user) return '';
    
    if (user.isOnline) {
      return 'Online';
    }
    
    if (user.lastSeen) {
      const now = new Date();
      const lastSeen = new Date(user.lastSeen);
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
      
      if (diffMinutes < 1) {
        return 'Just now';
      } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else if (diffMinutes < 1440) { // 24 hours
        const hours = Math.floor(diffMinutes / 60);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diffMinutes / 1440);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    }
    
    return 'Offline';
  }, [onlineUsers]);
  
  // Get count of online users (excluding current user)
  const getOnlineCount = useCallback(() => {
    return getOnlineUsers().length;
  }, [getOnlineUsers]);
  
  // Get formatted online users text
  const getOnlineUsersText = useCallback(() => {
    const onlineUsersList = getOnlineUsers();
    
    if (onlineUsersList.length === 0) {
      return 'No one else is online';
    }
    
    if (onlineUsersList.length === 1) {
      return `${onlineUsersList[0].userName} is online`;
    }
    
    if (onlineUsersList.length <= 3) {
      const names = onlineUsersList.map(user => user.userName);
      return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are online`;
    }
    
    return `${onlineUsersList[0].userName} and ${onlineUsersList.length - 1} others are online`;
  }, [getOnlineUsers]);
  
  // Manually set user online
  const setUserOnline = useCallback(() => {
    if (!isEnabled || !socketService.isConnected()) return;
    
    socketService.setUserOnline(userId, userName, conversationId);
    setIsCurrentUserOnline(true);
  }, [userId, userName, conversationId, isEnabled]);
  
  // Manually set user offline
  const setUserOffline = useCallback(() => {
    if (!isEnabled || !socketService.isConnected()) return;
    
    // Note: There's no explicit "setUserOffline" method in socketService
    // This would typically be handled by disconnecting or server-side logic
    setIsCurrentUserOnline(false);
  }, [isEnabled]);
  
  return {
    onlineUsers: getOnlineUsers(),
    offlineUsers: getOfflineUsers(),
    isCurrentUserOnline,
    isUserOnline,
    getLastSeen,
    getPresenceText,
    getOnlineCount,
    getOnlineUsersText,
    setUserOnline,
    setUserOffline,
    isConnected: socketService.isConnected(),
  };
};