import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Socket } from 'socket.io-client'
import { socketService } from '@services/socketService'
import { getSocketUrl } from '@config/env'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  error: string | null
  connect: (serverUrl?: string) => void
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | null>(null)

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: ReactNode
  serverUrl?: string
  autoConnect?: boolean
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  serverUrl = getSocketUrl(),
  autoConnect = true,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = (url?: string) => {
    try {
      setError(null)
      const newSocket = socketService.connect(url || serverUrl)
      setSocket(newSocket)

      // Set up event listeners
      newSocket.on('connect', () => {
        console.log('Socket connected')
        setIsConnected(true)
        setError(null)
      })

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
        setIsConnected(false)
        if (reason === 'io server disconnect') {
          // The disconnection was initiated by the server, reconnect manually
          newSocket.connect()
        }
      })

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err)
        setError(err.message || 'Connection failed')
        setIsConnected(false)
      })

      newSocket.on('error', (err) => {
        console.error('Socket error:', err)
        setError(err.message || 'Socket error')
      })

      // Handle reconnection attempts
      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber}`)
        setError(`Reconnecting... (attempt ${attemptNumber})`)
      })

      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`)
        setError(null)
        setIsConnected(true)
      })

      newSocket.on('reconnect_failed', () => {
        console.log('Reconnection failed')
        setError('Connection failed. Please check your internet connection.')
        setIsConnected(false)
      })
    } catch (err) {
      console.error('Error connecting to socket:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const disconnect = () => {
    if (socket) {
      socket.removeAllListeners()
      socketService.disconnect()
      setSocket(null)
      setIsConnected(false)
      setError(null)
    }
  }

  useEffect(() => {
    if (autoConnect) {
      connect(serverUrl)
    }

    return () => {
      disconnect()
    }
  }, [serverUrl, autoConnect])

  const value: SocketContextType = {
    socket,
    isConnected,
    error,
    connect,
    disconnect,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
