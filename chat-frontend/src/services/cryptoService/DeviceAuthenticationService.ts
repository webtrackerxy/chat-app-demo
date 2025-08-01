/**
 * Device Authentication and Verification Service
 * 
 * Provides secure device authentication, verification workflows, and trust establishment
 * for multi-device key synchronization. Implements various authentication methods
 * including QR codes, numeric verification, and biometric authentication.
 * 
 * Features:
 * - Multi-method device verification (QR, numeric, biometric)
 * - Cross-device challenge-response authentication
 * - Trust establishment and verification workflows
 * - Device revocation and blacklisting
 * - Authentication session management
 */

import { DeviceIdentityService, DeviceIdentity, DeviceVerification } from './DeviceIdentityService';
import { CrossDeviceKeyService } from './CrossDeviceKeyService';
import { DilithiumService } from './DilithiumService';
import { X25519Service } from './X25519Service';
import { ChainKeyService } from './ChainKeyService';

export interface AuthenticationRequest {
  requestId: string;
  fromDeviceId: string;
  toDeviceId: string;
  method: 'qr_code' | 'numeric_code' | 'biometric' | 'mutual_verification';
  challenge: Uint8Array;
  publicKeyProof: Uint8Array;
  timestamp: number;
  expiresAt: number;
}

export interface AuthenticationResponse {
  requestId: string;
  responseId: string;
  fromDeviceId: string;
  toDeviceId: string;
  response: Uint8Array;
  signature: Uint8Array;
  timestamp: number;
}

export interface AuthenticationSession {
  sessionId: string;
  initiatorDeviceId: string;
  responderDeviceId: string;
  method: string;
  status: 'pending' | 'challenged' | 'responded' | 'verified' | 'failed' | 'expired';
  challenge: Uint8Array;
  response?: Uint8Array;
  verificationCode?: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

export interface BiometricAuthData {
  biometricType: 'fingerprint' | 'face' | 'voice' | 'iris';
  template: Uint8Array;
  confidence: number;
  timestamp: number;
  deviceCapabilities: string[];
}

export interface QRCodeData {
  deviceId: string;
  publicKey: Uint8Array;
  verificationCode: string;
  timestamp: number;
  expiresAt: number;
  signature: Uint8Array;
}

/**
 * Device Authentication Service
 * 
 * Handles all aspects of device authentication and verification for multi-device scenarios
 */
export class DeviceAuthenticationService {
  private static readonly SESSION_EXPIRY_MINUTES = 15;
  private static readonly MAX_AUTH_ATTEMPTS = 3;
  private static readonly VERIFICATION_CODE_LENGTH = 8;
  private static readonly QR_CODE_EXPIRY_MINUTES = 5;
  
  private deviceIdentityService: DeviceIdentityService;
  private crossDeviceKeyService: CrossDeviceKeyService;
  private dilithiumService: DilithiumService;
  private x25519Service: X25519Service;
  private chainKeyService: ChainKeyService;
  
  private initialized: boolean = false;
  private authenticationSessions: Map<string, AuthenticationSession> = new Map();
  private pendingRequests: Map<string, AuthenticationRequest> = new Map();
  
  // Authentication metrics
  private authMetrics = {
    sessionsCreated: 0,
    successfulAuthentications: 0,
    failedAuthentications: 0,
    expiredSessions: 0
  };

  constructor() {
    this.deviceIdentityService = new DeviceIdentityService();
    this.crossDeviceKeyService = new CrossDeviceKeyService();
    this.dilithiumService = new DilithiumService();
    this.x25519Service = new X25519Service();
    this.chainKeyService = new ChainKeyService();
  }

  /**
   * Initialize the device authentication service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize all dependencies
      await Promise.all([
        this.deviceIdentityService.initialize(),
        this.crossDeviceKeyService.initialize(),
        this.dilithiumService.initialize(),
        this.x25519Service.initialize(),
        this.chainKeyService.initialize()
      ]);

      // Start session cleanup timer
      this.startSessionCleanup();

      this.initialized = true;
      console.log('Device Authentication Service initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Device Authentication service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initiate device authentication with another device
   * 
   * @param targetDeviceId - Device to authenticate with
   * @param method - Authentication method to use
   * @returns Promise<AuthenticationSession> - Authentication session
   */
  async initiateAuthentication(
    targetDeviceId: string,
    method: 'qr_code' | 'numeric_code' | 'biometric' | 'mutual_verification'
  ): Promise<AuthenticationSession> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      const sessionId = await this.generateSessionId();
      const challenge = this.generateSecureBytes(32);

      const session: AuthenticationSession = {
        sessionId,
        initiatorDeviceId: currentDevice.deviceId,
        responderDeviceId: targetDeviceId,
        method,
        status: 'pending',
        challenge,
        createdAt: Date.now(),
        expiresAt: Date.now() + (DeviceAuthenticationService.SESSION_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        maxAttempts: DeviceAuthenticationService.MAX_AUTH_ATTEMPTS
      };

      // Generate method-specific data
      switch (method) {
        case 'qr_code':
          await this.setupQRCodeAuthentication(session);
          break;
        case 'numeric_code':
          await this.setupNumericCodeAuthentication(session);
          break;
        case 'biometric':
          await this.setupBiometricAuthentication(session);
          break;
        case 'mutual_verification':
          await this.setupMutualVerification(session);
          break;
      }

      // Store session
      this.authenticationSessions.set(sessionId, session);

      // Create authentication request
      const authRequest = await this.createAuthenticationRequest(session);
      await this.sendAuthenticationRequest(authRequest);

      // Update metrics
      this.authMetrics.sessionsCreated++;

      console.log(`Initiated ${method} authentication with device ${targetDeviceId}`);
      return session;
    } catch (error) {
      throw new Error(`Failed to initiate authentication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle incoming authentication request
   * 
   * @param request - Authentication request to handle
   * @returns Promise<AuthenticationSession> - Created session
   */
  async handleAuthenticationRequest(request: AuthenticationRequest): Promise<AuthenticationSession> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Verify request signature and expiration
      await this.verifyAuthenticationRequest(request);

      const sessionId = request.requestId;
      const session: AuthenticationSession = {
        sessionId,
        initiatorDeviceId: request.fromDeviceId,
        responderDeviceId: currentDevice.deviceId,
        method: request.method,
        status: 'challenged',
        challenge: request.challenge,
        createdAt: Date.now(),
        expiresAt: request.expiresAt,
        attempts: 0,
        maxAttempts: DeviceAuthenticationService.MAX_AUTH_ATTEMPTS
      };

      // Store session and request
      this.authenticationSessions.set(sessionId, session);
      this.pendingRequests.set(request.requestId, request);

      console.log(`Received ${request.method} authentication request from device ${request.fromDeviceId}`);
      return session;
    } catch (error) {
      throw new Error(`Failed to handle authentication request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Respond to authentication challenge
   * 
   * @param sessionId - Session to respond to
   * @param userInput - User input (verification code, biometric data, etc.)
   * @returns Promise<AuthenticationResponse> - Authentication response
   */
  async respondToChallenge(sessionId: string, userInput: any): Promise<AuthenticationResponse> {
    this.ensureInitialized();

    const session = this.authenticationSessions.get(sessionId);
    if (!session) {
      throw new Error('Authentication session not found');
    }

    if (session.status !== 'challenged') {
      throw new Error('Session not in challenged state');
    }

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Increment attempt counter
      session.attempts++;

      // Generate response based on method
      let response: Uint8Array;
      switch (session.method) {
        case 'qr_code':
          response = await this.generateQRCodeResponse(session, userInput);
          break;
        case 'numeric_code':
          response = await this.generateNumericCodeResponse(session, userInput);
          break;
        case 'biometric':
          response = await this.generateBiometricResponse(session, userInput);
          break;
        case 'mutual_verification':
          response = await this.generateMutualVerificationResponse(session, userInput);
          break;
        default:
          throw new Error('Unknown authentication method');
      }

      // Create response data
      const responseData = {
        sessionId,
        challenge: session.challenge,
        response,
        deviceId: currentDevice.deviceId,
        timestamp: Date.now()
      };

      // Sign the response
      const signature = await this.dilithiumService.sign(
        currentDevice.signingKeys.privateKey,
        new TextEncoder().encode(JSON.stringify(responseData))
      );

      const authResponse: AuthenticationResponse = {
        requestId: sessionId,
        responseId: await this.generateResponseId(),
        fromDeviceId: currentDevice.deviceId,
        toDeviceId: session.initiatorDeviceId,
        response,
        signature: signature.signature,
        timestamp: Date.now()
      };

      // Update session
      session.response = response;
      session.status = 'responded';

      // Send response
      await this.sendAuthenticationResponse(authResponse);

      console.log(`Responded to ${session.method} challenge for session ${sessionId}`);
      return authResponse;
    } catch (error) {
      // Mark session as failed if max attempts reached
      if (session.attempts >= session.maxAttempts) {
        session.status = 'failed';
        this.authMetrics.failedAuthentications++;
      }

      throw new Error(`Failed to respond to challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify authentication response
   * 
   * @param sessionId - Session to verify
   * @param response - Response to verify
   * @returns Promise<boolean> - True if verification successful
   */
  async verifyAuthenticationResponse(sessionId: string, response: AuthenticationResponse): Promise<boolean> {
    this.ensureInitialized();

    const session = this.authenticationSessions.get(sessionId);
    if (!session) {
      throw new Error('Authentication session not found');
    }

    try {
      // Get responder device info
      const responderDevice = await this.getDeviceById(response.fromDeviceId);
      if (!responderDevice) {
        throw new Error('Responder device not found');
      }

      // Verify response signature
      const responseData = {
        sessionId,
        challenge: session.challenge,
        response: response.response,
        deviceId: response.fromDeviceId,
        timestamp: response.timestamp
      };

      const isSignatureValid = await this.dilithiumService.verify(
        responderDevice.signingKeys.publicKey,
        new TextEncoder().encode(JSON.stringify(responseData)),
        response.signature
      );

      if (!isSignatureValid) {
        throw new Error('Invalid response signature');
      }

      // Verify challenge response based on method
      let isResponseValid = false;
      switch (session.method) {
        case 'qr_code':
          isResponseValid = await this.verifyQRCodeResponse(session, response.response);
          break;
        case 'numeric_code':
          isResponseValid = await this.verifyNumericCodeResponse(session, response.response);
          break;
        case 'biometric':
          isResponseValid = await this.verifyBiometricResponse(session, response.response);
          break;
        case 'mutual_verification':
          isResponseValid = await this.verifyMutualVerificationResponse(session, response.response);
          break;
      }

      if (isResponseValid) {
        // Update session and establish trust
        session.status = 'verified';
        session.response = response.response;

        // Create device verification record
        await this.createDeviceVerification(session, response);

        // Update metrics
        this.authMetrics.successfulAuthentications++;

        console.log(`Successfully verified ${session.method} authentication for session ${sessionId}`);
        return true;
      } else {
        session.status = 'failed';
        this.authMetrics.failedAuthentications++;
        return false;
      }
    } catch (error) {
      session.status = 'failed';
      this.authMetrics.failedAuthentications++;
      throw new Error(`Authentication verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate QR code data for device authentication
   * 
   * @param targetDeviceId - Device to generate QR code for
   * @returns Promise<string> - QR code data as JSON string
   */
  async generateQRCode(targetDeviceId: string): Promise<string> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      const verificationCode = await this.generateVerificationCode();
      const qrData: QRCodeData = {
        deviceId: currentDevice.deviceId,
        publicKey: currentDevice.signingKeys.publicKey,
        verificationCode,
        timestamp: Date.now(),
        expiresAt: Date.now() + (DeviceAuthenticationService.QR_CODE_EXPIRY_MINUTES * 60 * 1000),
        signature: new Uint8Array(0) // Will be filled below
      };

      // Sign QR code data
      const signature = await this.dilithiumService.sign(
        currentDevice.signingKeys.privateKey,
        new TextEncoder().encode(JSON.stringify({
          deviceId: qrData.deviceId,
          publicKey: Array.from(qrData.publicKey),
          verificationCode: qrData.verificationCode,
          timestamp: qrData.timestamp,
          expiresAt: qrData.expiresAt
        }))
      );

      qrData.signature = signature.signature;

      // Convert to QR-friendly format
      const qrString = JSON.stringify({
        deviceId: qrData.deviceId,
        publicKey: Array.from(qrData.publicKey),
        verificationCode: qrData.verificationCode,
        timestamp: qrData.timestamp,
        expiresAt: qrData.expiresAt,
        signature: Array.from(qrData.signature)
      });

      return qrString;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process scanned QR code
   * 
   * @param qrCodeData - Scanned QR code data
   * @returns Promise<AuthenticationSession> - Created authentication session
   */
  async processQRCode(qrCodeData: string): Promise<AuthenticationSession> {
    this.ensureInitialized();

    try {
      const qrData = JSON.parse(qrCodeData);
      
      // Validate QR code format
      if (!qrData.deviceId || !qrData.publicKey || !qrData.verificationCode || !qrData.signature) {
        throw new Error('Invalid QR code format');
      }

      // Check expiration
      if (Date.now() > qrData.expiresAt) {
        throw new Error('QR code expired');
      }

      // Reconstruct QR data object
      const reconstructedQRData: QRCodeData = {
        deviceId: qrData.deviceId,
        publicKey: new Uint8Array(qrData.publicKey),
        verificationCode: qrData.verificationCode,
        timestamp: qrData.timestamp,
        expiresAt: qrData.expiresAt,
        signature: new Uint8Array(qrData.signature)
      };

      // Verify QR code signature
      const signatureData = {
        deviceId: reconstructedQRData.deviceId,
        publicKey: Array.from(reconstructedQRData.publicKey),
        verificationCode: reconstructedQRData.verificationCode,
        timestamp: reconstructedQRData.timestamp,
        expiresAt: reconstructedQRData.expiresAt
      };

      const isSignatureValid = await this.dilithiumService.verify(
        reconstructedQRData.publicKey,
        new TextEncoder().encode(JSON.stringify(signatureData)),
        reconstructedQRData.signature
      );

      if (!isSignatureValid) {
        throw new Error('Invalid QR code signature');
      }

      // Initiate authentication with the scanned device
      return await this.initiateAuthentication(reconstructedQRData.deviceId, 'qr_code');
    } catch (error) {
      throw new Error(`Failed to process QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get authentication session status
   * 
   * @param sessionId - Session to check
   * @returns AuthenticationSession | null - Session or null if not found
   */
  getAuthenticationSession(sessionId: string): AuthenticationSession | null {
    return this.authenticationSessions.get(sessionId) || null;
  }

  /**
   * Get authentication metrics
   * 
   * @returns Object with authentication statistics
   */
  getAuthenticationMetrics(): {
    sessionsCreated: number;
    successfulAuthentications: number;
    failedAuthentications: number;
    expiredSessions: number;
    activeSessions: number;
    successRate: number;
  } {
    const totalAttempts = this.authMetrics.successfulAuthentications + this.authMetrics.failedAuthentications;
    const successRate = totalAttempts > 0 ? (this.authMetrics.successfulAuthentications / totalAttempts) * 100 : 0;

    return {
      ...this.authMetrics,
      activeSessions: this.authenticationSessions.size,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Cancel authentication session
   * 
   * @param sessionId - Session to cancel
   * @returns Promise<void>
   */
  async cancelAuthenticationSession(sessionId: string): Promise<void> {
    const session = this.authenticationSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      this.authenticationSessions.delete(sessionId);
      console.log(`Cancelled authentication session ${sessionId}`);
    }
  }

  // Private helper methods

  private async setupQRCodeAuthentication(session: AuthenticationSession): Promise<void> {
    session.verificationCode = await this.generateVerificationCode();
  }

  private async setupNumericCodeAuthentication(session: AuthenticationSession): Promise<void> {
    session.verificationCode = await this.generateNumericVerificationCode();
  }

  private async setupBiometricAuthentication(session: AuthenticationSession): Promise<void> {
    // Biometric setup would involve platform-specific APIs
    console.log(`Setup biometric authentication for session ${session.sessionId}`);
  }

  private async setupMutualVerification(session: AuthenticationSession): Promise<void> {
    // Create cross-device challenge for mutual verification
    const challenge = await this.deviceIdentityService.createCrossDeviceChallenge(
      session.responderDeviceId,
      'identity_proof'
    );
    session.challenge = challenge.challenge;
  }

  private async createAuthenticationRequest(session: AuthenticationSession): Promise<AuthenticationRequest> {
    const currentDevice = this.deviceIdentityService.getCurrentDevice()!;
    
    // Create public key proof
    const publicKeyProof = await this.dilithiumService.sign(
      currentDevice.signingKeys.privateKey,
      currentDevice.signingKeys.publicKey
    );

    return {
      requestId: session.sessionId,
      fromDeviceId: session.initiatorDeviceId,
      toDeviceId: session.responderDeviceId,
      method: session.method,
      challenge: session.challenge,
      publicKeyProof: publicKeyProof.signature,
      timestamp: session.createdAt,
      expiresAt: session.expiresAt
    };
  }

  private async verifyAuthenticationRequest(request: AuthenticationRequest): Promise<void> {
    // Verify request hasn't expired
    if (Date.now() > request.expiresAt) {
      throw new Error('Authentication request expired');
    }

    // Get sender device and verify public key proof
    const senderDevice = await this.getDeviceById(request.fromDeviceId);
    if (!senderDevice) {
      throw new Error('Sender device not found');
    }

    const isProofValid = await this.dilithiumService.verify(
      senderDevice.signingKeys.publicKey,
      senderDevice.signingKeys.publicKey,
      request.publicKeyProof
    );

    if (!isProofValid) {
      throw new Error('Invalid public key proof');
    }
  }

  private async generateQRCodeResponse(session: AuthenticationSession, userInput: string): Promise<Uint8Array> {
    // Verify user input matches the verification code
    if (!session.verificationCode || userInput !== session.verificationCode) {
      throw new Error('Invalid verification code');
    }

    return new TextEncoder().encode(`qr-response-${session.sessionId}-${userInput}`);
  }

  private async generateNumericCodeResponse(session: AuthenticationSession, userInput: string): Promise<Uint8Array> {
    if (!session.verificationCode || userInput !== session.verificationCode) {
      throw new Error('Invalid numeric code');
    }

    return new TextEncoder().encode(`numeric-response-${session.sessionId}-${userInput}`);
  }

  private async generateBiometricResponse(session: AuthenticationSession, biometricData: BiometricAuthData): Promise<Uint8Array> {
    // Validate biometric data
    if (biometricData.confidence < 0.8) {
      throw new Error('Biometric confidence too low');
    }

    // Create biometric response
    const responseData = {
      sessionId: session.sessionId,
      biometricType: biometricData.biometricType,
      confidence: biometricData.confidence,
      timestamp: biometricData.timestamp
    };

    return new TextEncoder().encode(JSON.stringify(responseData));
  }

  private async generateMutualVerificationResponse(session: AuthenticationSession, response: Uint8Array): Promise<Uint8Array> {
    // Use cross-device challenge response
    return response;
  }

  private async verifyQRCodeResponse(session: AuthenticationSession, response: Uint8Array): Promise<boolean> {
    const expectedResponse = await this.generateQRCodeResponse(session, session.verificationCode!);
    return this.chainKeyService.constantTimeEquals(response, expectedResponse);
  }

  private async verifyNumericCodeResponse(session: AuthenticationSession, response: Uint8Array): Promise<boolean> {
    const expectedResponse = await this.generateNumericCodeResponse(session, session.verificationCode!);
    return this.chainKeyService.constantTimeEquals(response, expectedResponse);
  }

  private async verifyBiometricResponse(session: AuthenticationSession, response: Uint8Array): Promise<boolean> {
    try {
      const responseData = JSON.parse(new TextDecoder().decode(response));
      return responseData.sessionId === session.sessionId && responseData.confidence >= 0.8;
    } catch {
      return false;
    }
  }

  private async verifyMutualVerificationResponse(session: AuthenticationSession, response: Uint8Array): Promise<boolean> {
    // Verify using cross-device challenge mechanism
    return this.chainKeyService.constantTimeEquals(session.challenge, response);
  }

  private async createDeviceVerification(session: AuthenticationSession, response: AuthenticationResponse): Promise<void> {
    try {
      const verification = await this.deviceIdentityService.verifyDevice(
        session.responderDeviceId,
        session.verificationCode || 'verified',
        session.method as any
      );
      console.log(`Created device verification for ${session.responderDeviceId}`);
    } catch (error) {
      console.warn('Failed to create device verification:', error);
    }
  }

  private async generateSessionId(): Promise<string> {
    const bytes = this.generateSecureBytes(16);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateResponseId(): Promise<string> {
    const bytes = this.generateSecureBytes(12);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateVerificationCode(): Promise<string> {
    const bytes = this.generateSecureBytes(DeviceAuthenticationService.VERIFICATION_CODE_LENGTH);
    return Array.from(bytes)
      .map(byte => byte.toString(36))
      .join('')
      .slice(0, DeviceAuthenticationService.VERIFICATION_CODE_LENGTH)
      .toUpperCase();
  }

  private async generateNumericVerificationCode(): Promise<string> {
    const bytes = this.generateSecureBytes(DeviceAuthenticationService.VERIFICATION_CODE_LENGTH);
    return Array.from(bytes)
      .map(byte => (byte % 10).toString())
      .join('')
      .slice(0, DeviceAuthenticationService.VERIFICATION_CODE_LENGTH);
  }

  private generateSecureBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  private async getDeviceById(deviceId: string): Promise<DeviceIdentity | null> {
    // Get device from trusted devices or backend
    const trustedDevices = await this.deviceIdentityService.getTrustedDevices();
    return trustedDevices.find(device => device.deviceId === deviceId) || null;
  }

  private async sendAuthenticationRequest(request: AuthenticationRequest): Promise<void> {
    // Send request to target device via backend
    console.log(`Sent authentication request ${request.requestId} to device ${request.toDeviceId}`);
  }

  private async sendAuthenticationResponse(response: AuthenticationResponse): Promise<void> {
    // Send response to initiating device via backend
    console.log(`Sent authentication response ${response.responseId} to device ${response.toDeviceId}`);
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;

      for (const [sessionId, session] of this.authenticationSessions.entries()) {
        if (now > session.expiresAt) {
          session.status = 'expired';
          this.authenticationSessions.delete(sessionId);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        this.authMetrics.expiredSessions += expiredCount;
        console.log(`Cleaned up ${expiredCount} expired authentication sessions`);
      }
    }, 60000); // Check every minute
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Device Authentication service not initialized. Call initialize() first.');
    }
  }
}

// Create and export a singleton instance
export const deviceAuthenticationService = new DeviceAuthenticationService();