/**
 * Participant Emulator Service
 * Simulates other participants in conversations
 */

import { StorageApiFactory } from '@api/storageApi'

interface EmulatedParticipant {
  id: string
  name: string
  personality: 'friendly' | 'technical' | 'casual' | 'helpful'
  responseDelay: number // milliseconds
}

const EMULATED_PARTICIPANTS: EmulatedParticipant[] = [
  { id: 'bot-alice', name: 'Alice', personality: 'friendly', responseDelay: 2000 },
  { id: 'bot-bob', name: 'Bob', personality: 'technical', responseDelay: 3000 },
  { id: 'bot-charlie', name: 'Charlie', personality: 'casual', responseDelay: 2500 },
  { id: 'bot-diana', name: 'Diana', personality: 'helpful', responseDelay: 1800 },
]

const RESPONSE_TEMPLATES = {
  friendly: [
    "That's a great point! 😊",
    'I completely agree with you!',
    'Thanks for sharing that!',
    'How has everyone been doing?',
    'That sounds really interesting!',
  ],
  technical: [
    'Have you considered the technical implications?',
    'We should also think about scalability here.',
    'What about the performance impact?',
    "I'd suggest we document this approach.",
    "Let's make sure we handle edge cases.",
  ],
  casual: [
    'Sounds good to me! 👍',
    'Haha, totally!',
    'Yeah, I was thinking the same thing.',
    "Cool, let's do it!",
    'No worries, we got this!',
  ],
  helpful: [
    'I can help with that if needed.',
    "Here's what I think we should do...",
    'Would it help if I looked into this?',
    'I found some information that might be useful.',
    'Let me know if you need any assistance!',
  ],
}

export class ParticipantEmulator {
  private static instance: ParticipantEmulator
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private storageApi = StorageApiFactory.getApi('local')
  private messageAddedCallback?: (conversationId: string) => void

  static getInstance(): ParticipantEmulator {
    if (!ParticipantEmulator.instance) {
      ParticipantEmulator.instance = new ParticipantEmulator()
    }
    return ParticipantEmulator.instance
  }

  setMessageAddedCallback(callback: (conversationId: string) => void): void {
    this.messageAddedCallback = callback
  }

  /**
   * Starts emulating participants for a conversation
   * Called when user sends a message
   */
  async emulateResponse(
    conversationId: string,
    userMessage: string,
    userName: string,
  ): Promise<void> {
    console.log('🤖 Emulator triggered:', { conversationId, userMessage, userName })

    // Don't respond to system messages or emulated participants
    if (
      userName === 'System' ||
      userName.startsWith('bot-') ||
      EMULATED_PARTICIPANTS.some((p) => p.name === userName)
    ) {
      console.log('🤖 Skipping response - system or emulated participant:', userName)
      return
    }

    // Randomly select 1-2 participants to respond
    const respondingParticipants = this.selectRespondingParticipants()
    console.log(
      '🤖 Selected participants to respond:',
      respondingParticipants.map((p) => p.name),
    )

    for (const participant of respondingParticipants) {
      this.scheduleResponse(conversationId, participant, userMessage)
    }
  }

  /**
   * Adds initial participants to a new conversation
   */
  async populateConversation(conversationId: string): Promise<void> {
    // Add 2-3 random participants to make conversations feel alive
    const participants = this.getRandomParticipants(2, 3)

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i]
      const delay = (i + 1) * 1000 // Stagger introductions

      setTimeout(async () => {
        const introMessage = this.generateIntroMessage(participant)
        await this.sendEmulatedMessage(conversationId, participant, introMessage)
      }, delay)
    }
  }

  /**
   * Sends periodic activity to keep conversations alive
   */
  startPeriodicActivity(conversationId: string): void {
    const interval = 30000 + Math.random() * 60000 // 30-90 seconds

    const timeout = setTimeout(async () => {
      const participant = this.getRandomParticipants(1, 1)[0]
      const message = this.generatePeriodicMessage(participant)
      await this.sendEmulatedMessage(conversationId, participant, message)

      // Schedule next periodic activity
      this.startPeriodicActivity(conversationId)
    }, interval)

    this.activeTimeouts.set(`periodic-${conversationId}`, timeout)
  }

  private selectRespondingParticipants(): EmulatedParticipant[] {
    const numResponders = Math.random() < 0.7 ? 1 : 2 // 70% chance of 1 responder, 30% chance of 2
    return this.getRandomParticipants(numResponders, numResponders)
  }

  private getRandomParticipants(min: number, max: number): EmulatedParticipant[] {
    const count = Math.floor(Math.random() * (max - min + 1)) + min
    const shuffled = [...EMULATED_PARTICIPANTS].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  private scheduleResponse(
    conversationId: string,
    participant: EmulatedParticipant,
    userMessage: string,
  ): void {
    console.log(`🤖 Scheduling response from ${participant.name} in ${participant.responseDelay}ms`)

    const timeout = setTimeout(async () => {
      const response = this.generateResponse(participant, userMessage)
      console.log(`🤖 ${participant.name} responding: "${response}"`)
      await this.sendEmulatedMessage(conversationId, participant, response)
    }, participant.responseDelay)

    this.activeTimeouts.set(`${conversationId}-${participant.id}`, timeout)
  }

  private generateResponse(participant: EmulatedParticipant, userMessage: string): string {
    const templates = RESPONSE_TEMPLATES[participant.personality]

    // Simple keyword-based responses
    const lowerMessage = userMessage.toLowerCase()

    if (lowerMessage.includes('help') || lowerMessage.includes('question')) {
      return participant.personality === 'helpful'
        ? 'I can help with that if needed.'
        : templates[Math.floor(Math.random() * templates.length)]
    }

    if (lowerMessage.includes('thanks') || lowerMessage.includes('thank you')) {
      return participant.personality === 'friendly' ? "You're welcome! 😊" : 'No problem!'
    }

    if (
      lowerMessage.includes('technical') ||
      lowerMessage.includes('code') ||
      lowerMessage.includes('api')
    ) {
      return participant.personality === 'technical'
        ? 'Have you considered the technical implications?'
        : templates[Math.floor(Math.random() * templates.length)]
    }

    // Default to random response from personality
    return templates[Math.floor(Math.random() * templates.length)]
  }

  private generateIntroMessage(participant: EmulatedParticipant): string {
    const intros = [
      `Hi everyone! ${participant.name} here 👋`,
      `Hello! Excited to be part of this conversation!`,
      `Hey all! Looking forward to chatting with you.`,
      `Hi! Great to see an active conversation going.`,
    ]
    return intros[Math.floor(Math.random() * intros.length)]
  }

  private generatePeriodicMessage(participant: EmulatedParticipant): string {
    const messages = [
      'How is everyone doing?',
      'Any updates on your end?',
      "Hope you're all having a great day!",
      'Quick check-in - how are things going?',
      'Anyone have thoughts on what we discussed earlier?',
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }

  private async sendEmulatedMessage(
    conversationId: string,
    participant: EmulatedParticipant,
    text: string,
  ): Promise<void> {
    try {
      console.log(`🤖 Sending emulated message from ${participant.name}: "${text}"`)

      await this.storageApi.sendMessage({
        text,
        conversationId,
        senderId: participant.id,
        senderName: participant.name,
      })

      console.log(`🤖 Message sent successfully from ${participant.name}`)

      // Notify the callback that a message was added
      if (this.messageAddedCallback) {
        this.messageAddedCallback(conversationId)
      }
    } catch (error) {
      console.warn('Failed to send emulated message:', error)
    }
  }

  /**
   * Clean up timeouts when leaving a conversation
   */
  stopEmulation(conversationId: string): void {
    const keys = Array.from(this.activeTimeouts.keys()).filter((key) =>
      key.includes(conversationId),
    )
    keys.forEach((key) => {
      const timeout = this.activeTimeouts.get(key)
      if (timeout) {
        clearTimeout(timeout)
        this.activeTimeouts.delete(key)
      }
    })
  }
}
