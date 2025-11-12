import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { logger } from './lib/logger';
import { db } from './db';
import { stationTelemetry, stationAlerts, petWashStations } from '@shared/schema-enterprise';
import { desc, eq } from 'drizzle-orm';

interface ClientConnection {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>; // station IDs or 'all'
  lastPing: number;
  ip: string;
  messageCount: number;
  lastMessageTime: number;
  authenticated: boolean;
  userId?: string; // Firebase UID for messaging
  messageConversations: Set<string>; // Conversation IDs for team messaging
}

const clients = new Map<string, ClientConnection>();
const connectionsByIp = new Map<string, number>();

// Configuration - Production-Ready Scalability
const MAX_MESSAGES_PER_MINUTE = 60;
const MAX_TOTAL_CONNECTIONS = Number(process.env.WS_MAX_TOTAL_CONN) || 1000; // Increased for production scale
const MAX_CONNECTIONS_PER_IP = Number(process.env.WS_MAX_CONN_PER_IP) || 50; // Enable per-origin quotas
const ENABLE_PER_IP_LIMITING = MAX_CONNECTIONS_PER_IP > 0;

// Allowed origins for WebSocket connections (production)
const ALLOWED_ORIGINS = [
  'https://api.petwash.co.il',
  'https://hub.petwash.co.il',
  'https://status.petwash.co.il',
  'http://localhost:5000', // Development
  'http://127.0.0.1:5000', // Development
  'https://pet-wash-nl-nirhadad1.replit.app', // Replit deployment
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  
  try {
    const url = new URL(origin);
    const originString = `${url.protocol}//${url.host}`;
    return ALLOWED_ORIGINS.includes(originString);
  } catch (e) {
    return false;
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/realtime',
    clientTracking: true,
    verifyClient: (info: { origin: string; req: IncomingMessage; secure: boolean }) => {
      // Origin validation
      const origin = info.origin || info.req.headers.origin;
      
      // In production, strictly enforce allowed origins
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
      if (isProduction) {
        // Reject connections with missing Origin in production
        if (!origin) {
          logger.warn(`[WebSocket] Rejected connection with missing Origin header`);
          return false;
        }
        
        // Validate origin exactly (no prefix matching)
        if (!isOriginAllowed(origin)) {
          logger.warn(`[WebSocket] Rejected connection from unauthorized origin: ${origin}`);
          return false;
        }
      } else if (origin && !isOriginAllowed(origin)) {
        // In dev, warn but allow for testing
        logger.warn(`[WebSocket] Dev mode: allowing origin ${origin}`);
      }
      
      // Check total connection limit
      if (clients.size >= MAX_TOTAL_CONNECTIONS) {
        logger.warn(`[WebSocket] Rejected connection - max total connections (${MAX_TOTAL_CONNECTIONS}) reached`);
        return false;
      }
      
      // Check per-IP connection limit (optional - disabled by default due to proxy/LB issues)
      if (ENABLE_PER_IP_LIMITING) {
        const clientIp = info.req.socket.remoteAddress || 'unknown';
        const ipConnections = connectionsByIp.get(clientIp) || 0;
        if (ipConnections >= MAX_CONNECTIONS_PER_IP) {
          logger.warn(`[WebSocket] Rejected connection from ${clientIp} - max connections per IP (${MAX_CONNECTIONS_PER_IP}) reached`);
          return false;
        }
      }
      
      return true;
    }
  });

  logger.info('[WebSocket] Initializing real-time IoT & telemetry server at /realtime');
  logger.info(`[WebSocket] Security: Origin validation ${process.env.REPLIT_DEPLOYMENT === '1' ? 'ENABLED' : 'RELAXED (dev)'}`);
  logger.info(`[WebSocket] Per-IP limiting: ${ENABLE_PER_IP_LIMITING ? `ENABLED (max ${MAX_CONNECTIONS_PER_IP}/IP)` : 'DISABLED (recommended for production behind proxy)'}`);
  logger.info(`[WebSocket] Limits: ${MAX_TOTAL_CONNECTIONS} total connections, ${MAX_MESSAGES_PER_MINUTE} msgs/min per client`);

  wss.on('connection', (ws: WebSocket, req) => {
    const clientId = generateClientId();
    const clientIp = req.socket.remoteAddress || 'unknown';
    
    // Track connections per IP (only if per-IP limiting is enabled)
    if (ENABLE_PER_IP_LIMITING) {
      connectionsByIp.set(clientIp, (connectionsByIp.get(clientIp) || 0) + 1);
    }
    
    const client: ClientConnection = {
      ws,
      id: clientId,
      subscriptions: new Set(),
      lastPing: Date.now(),
      ip: clientIp,
      messageCount: 0,
      lastMessageTime: Date.now(),
      authenticated: false,
      messageConversations: new Set()
    };

    clients.set(clientId, client);
    logger.info(`[WebSocket] Client ${clientId} connected from ${clientIp} (${clients.size} active)`);

    // Send welcome message with authentication requirement
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to PetWash™ Enterprise real-time telemetry',
      authenticated: false,
      note: 'Send auth token to access protected data'
    }));

    // Handle incoming messages with rate limiting
    ws.on('message', async (data: Buffer) => {
      try {
        // Rate limiting: Check messages per minute
        const now = Date.now();
        if (now - client.lastMessageTime >= 60000) {
          // Reset counter every minute
          client.messageCount = 0;
          client.lastMessageTime = now;
        }
        
        client.messageCount++;
        
        if (client.messageCount > MAX_MESSAGES_PER_MINUTE) {
          logger.warn(`[WebSocket] Client ${clientId} exceeded rate limit (${MAX_MESSAGES_PER_MINUTE}/min)`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded. Max 60 messages per minute.',
            timestamp: new Date().toISOString()
          }));
          return;
        }
        
        const message = JSON.parse(data.toString());
        await handleClientMessage(client, message);
      } catch (error) {
        logger.error(`[WebSocket] Error processing message from ${clientId}:`, error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }));
      }
    });

    // Handle pong responses
    ws.on('pong', () => {
      client.lastPing = Date.now();
    });

    // Handle disconnection
    ws.on('close', () => {
      clients.delete(clientId);
      
      // Decrement IP connection count (only if per-IP limiting is enabled)
      if (ENABLE_PER_IP_LIMITING) {
        const ipCount = connectionsByIp.get(clientIp) || 0;
        if (ipCount <= 1) {
          connectionsByIp.delete(clientIp);
        } else {
          connectionsByIp.set(clientIp, ipCount - 1);
        }
      }
      
      logger.info(`[WebSocket] Client ${clientId} disconnected. Active clients: ${clients.size}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`[WebSocket] Client ${clientId} error:`, error);
      clients.delete(clientId);
      
      // Decrement IP connection count (only if per-IP limiting is enabled)
      if (ENABLE_PER_IP_LIMITING) {
        const ipCount = connectionsByIp.get(clientIp) || 0;
        if (ipCount <= 1) {
          connectionsByIp.delete(clientIp);
        } else {
          connectionsByIp.set(clientIp, ipCount - 1);
        }
      }
    });
  });

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    clients.forEach((client, clientId) => {
      // Remove clients that haven't responded to ping in 35 seconds
      if (now - client.lastPing > 35000) {
        logger.warn(`[WebSocket] Client ${clientId} timeout - removing`);
        client.ws.terminate();
        clients.delete(clientId);
        return;
      }

      // Send ping
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    });
  }, 30000); // Every 30 seconds

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    logger.info('[WebSocket] Server closed');
  });

  logger.info('[WebSocket] Real-time server ready');
  return wss;
}

async function handleClientMessage(client: ClientConnection, message: any) {
  const { type, payload } = message;

  switch (type) {
    case 'auth':
      await handleAuth(client, payload);
      break;

    case 'subscribe':
      if (!client.authenticated) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required. Send auth message first.',
          timestamp: new Date().toISOString()
        }));
        return;
      }
      handleSubscribe(client, payload);
      break;

    case 'unsubscribe':
      handleUnsubscribe(client, payload);
      break;

    case 'get_stations':
      // Public endpoint - no auth required for basic station list
      await sendStationsSnapshot(client);
      break;

    case 'get_telemetry':
      if (!client.authenticated) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required for telemetry data.',
          timestamp: new Date().toISOString()
        }));
        return;
      }
      await sendTelemetrySnapshot(client, payload);
      break;

    case 'get_alerts':
      if (!client.authenticated) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required for alerts data.',
          timestamp: new Date().toISOString()
        }));
        return;
      }
      await sendAlertsSnapshot(client, payload);
      break;

    case 'ping':
      client.ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }));
      break;

    case 'auth_messaging':
      await handleMessagingAuth(client, payload);
      break;

    case 'subscribe_conversations':
      if (!client.userId) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Authentication required for messaging. Send auth_messaging message first.',
          timestamp: new Date().toISOString()
        }));
        return;
      }
      await handleConversationSubscribe(client, payload);
      break;

    case 'unsubscribe_conversations':
      handleConversationUnsubscribe(client, payload);
      break;

    default:
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${type}`,
        timestamp: new Date().toISOString()
      }));
  }
}

async function handleAuth(client: ClientConnection, payload: any) {
  const { token } = payload || {};
  
  if (!token) {
    client.ws.send(JSON.stringify({
      type: 'auth_failed',
      message: 'No token provided',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // API key authentication - REQUIRED in production
  const VALID_API_KEY = process.env.WEBSOCKET_API_KEY;
  
  if (!VALID_API_KEY) {
    logger.error('[WebSocket] CRITICAL: WEBSOCKET_API_KEY environment variable not set!');
    client.ws.send(JSON.stringify({
      type: 'auth_failed',
      message: 'Server configuration error',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  if (token === VALID_API_KEY) {
    client.authenticated = true;
    logger.info(`[WebSocket] Client ${client.id} authenticated successfully`);
    
    client.ws.send(JSON.stringify({
      type: 'auth_success',
      message: 'Authentication successful',
      timestamp: new Date().toISOString()
    }));
  } else {
    logger.warn(`[WebSocket] Client ${client.id} failed authentication from IP ${client.ip}`);
    
    client.ws.send(JSON.stringify({
      type: 'auth_failed',
      message: 'Invalid token',
      timestamp: new Date().toISOString()
    }));
  }
}

function handleSubscribe(client: ClientConnection, payload: any) {
  const { stations } = payload || {};
  
  // Limit max subscriptions per client
  const MAX_SUBSCRIPTIONS = 50;
  
  if (stations === 'all') {
    // Only allow 'all' for authenticated admin users
    // For now, restrict to specific stations
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'Subscribe to specific station IDs instead of "all" for security',
      timestamp: new Date().toISOString()
    }));
    return;
  } else if (Array.isArray(stations)) {
    // Check subscription limit
    if (client.subscriptions.size + stations.length > MAX_SUBSCRIPTIONS) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `Subscription limit exceeded. Max ${MAX_SUBSCRIPTIONS} stations per client.`,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    stations.forEach(stationId => client.subscriptions.add(String(stationId)));
    logger.info(`[WebSocket] Client ${client.id} subscribed to stations: ${stations.join(', ')}`);
  }

  client.ws.send(JSON.stringify({
    type: 'subscribed',
    subscriptions: Array.from(client.subscriptions),
    timestamp: new Date().toISOString()
  }));
}

function handleUnsubscribe(client: ClientConnection, payload: any) {
  const { stations } = payload || {};
  
  if (stations === 'all') {
    client.subscriptions.clear();
  } else if (Array.isArray(stations)) {
    stations.forEach(stationId => client.subscriptions.delete(String(stationId)));
  }

  client.ws.send(JSON.stringify({
    type: 'unsubscribed',
    subscriptions: Array.from(client.subscriptions),
    timestamp: new Date().toISOString()
  }));
}

async function sendStationsSnapshot(client: ClientConnection) {
  try {
    const stations = await db
      .select({
        id: petWashStations.id,
        stationCode: petWashStations.stationCode,
        stationName: petWashStations.stationName,
        city: petWashStations.city,
        operationalStatus: petWashStations.operationalStatus,
        healthStatus: petWashStations.healthStatus,
        lastHeartbeat: petWashStations.lastHeartbeat,
      })
      .from(petWashStations)
      .orderBy(petWashStations.stationCode);

    client.ws.send(JSON.stringify({
      type: 'stations_snapshot',
      data: stations,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error(`[WebSocket] Error fetching stations snapshot:`, error);
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch stations data',
      timestamp: new Date().toISOString()
    }));
  }
}

async function sendTelemetrySnapshot(client: ClientConnection, payload: any) {
  try {
    const { stationId, limit = 10 } = payload || {};
    
    // Enforce strict max limit
    const MAX_TELEMETRY_LIMIT = 100;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 10), MAX_TELEMETRY_LIMIT);
    
    if (!stationId) {
      // Reject all-stations telemetry requests in production
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
      if (isProduction) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Must specify stationId for telemetry requests',
          timestamp: new Date().toISOString()
        }));
        return;
      }
    }
    
    const telemetry = stationId
      ? await db
          .select()
          .from(stationTelemetry)
          .where(eq(stationTelemetry.stationId, stationId))
          .orderBy(desc(stationTelemetry.recordedAt))
          .limit(safeLimit)
      : await db
          .select()
          .from(stationTelemetry)
          .orderBy(desc(stationTelemetry.recordedAt))
          .limit(safeLimit);

    client.ws.send(JSON.stringify({
      type: 'telemetry_snapshot',
      data: telemetry,
      stationId,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error(`[WebSocket] Error fetching telemetry snapshot:`, error);
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch telemetry data',
      timestamp: new Date().toISOString()
    }));
  }
}

async function sendAlertsSnapshot(client: ClientConnection, payload: any) {
  try {
    const { stationId, limit = 20 } = payload || {};
    
    // Enforce strict max limit
    const MAX_ALERTS_LIMIT = 100;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), MAX_ALERTS_LIMIT);
    
    if (!stationId) {
      // Reject all-stations alert requests in production
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
      if (isProduction) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Must specify stationId for alerts requests',
          timestamp: new Date().toISOString()
        }));
        return;
      }
    }
    
    const alerts = stationId
      ? await db
          .select()
          .from(stationAlerts)
          .where(eq(stationAlerts.stationId, stationId))
          .orderBy(desc(stationAlerts.createdAt))
          .limit(safeLimit)
      : await db
          .select()
          .from(stationAlerts)
          .orderBy(desc(stationAlerts.createdAt))
          .limit(safeLimit);

    client.ws.send(JSON.stringify({
      type: 'alerts_snapshot',
      data: alerts,
      stationId,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error(`[WebSocket] Error fetching alerts snapshot:`, error);
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch alerts data',
      timestamp: new Date().toISOString()
    }));
  }
}

// Broadcast telemetry update to subscribed clients
export function broadcastTelemetryUpdate(stationId: number, telemetry: any) {
  const message = JSON.stringify({
    type: 'telemetry_update',
    stationId,
    data: telemetry,
    timestamp: new Date().toISOString()
  });

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN && client.authenticated) {
      if (client.subscriptions.has(String(stationId))) {
        client.ws.send(message);
      }
    }
  });
}

// Broadcast alert to subscribed clients
export function broadcastAlert(stationId: number, alert: any) {
  const message = JSON.stringify({
    type: 'alert',
    stationId,
    data: alert,
    timestamp: new Date().toISOString()
  });

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN && client.authenticated) {
      if (client.subscriptions.has(String(stationId))) {
        client.ws.send(message);
      }
    }
  });
}

// Broadcast station status change
export function broadcastStationStatusChange(stationId: number, status: any) {
  const message = JSON.stringify({
    type: 'station_status_change',
    stationId,
    data: status,
    timestamp: new Date().toISOString()
  });

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN && client.authenticated) {
      if (client.subscriptions.has(String(stationId))) {
        client.ws.send(message);
      }
    }
  });
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getActiveConnectionsCount(): number {
  return clients.size;
}

// Messaging authentication (Firebase token)
async function handleMessagingAuth(client: ClientConnection, payload: any) {
  const { firebaseToken } = payload || {};
  
  if (!firebaseToken) {
    client.ws.send(JSON.stringify({
      type: 'messaging_auth_failed',
      message: 'No Firebase token provided',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  try {
    // Import Firebase Admin at runtime to avoid circular dependencies
    const { auth } = await import('./lib/firebase-admin');
    // Verify token with revocation check (security requirement)
    const decodedToken = await auth.verifyIdToken(firebaseToken, true);
    
    client.userId = decodedToken.uid;
    logger.info(`[WebSocket] Client ${client.id} authenticated for messaging as user ${decodedToken.uid}`);
    
    client.ws.send(JSON.stringify({
      type: 'messaging_auth_success',
      message: 'Messaging authentication successful',
      userId: decodedToken.uid,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.warn(`[WebSocket] Client ${client.id} failed messaging authentication from IP ${client.ip}`);
    
    client.ws.send(JSON.stringify({
      type: 'messaging_auth_failed',
      message: 'Invalid Firebase token',
      timestamp: new Date().toISOString()
    }));
  }
}

// Subscribe to conversation updates - with participant authorization
async function handleConversationSubscribe(client: ClientConnection, payload: any) {
  const { conversationIds } = payload || {};
  
  if (!client.userId) {
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'User ID not set. Authenticate first.',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  const MAX_CONVERSATION_SUBSCRIPTIONS = 100;
  const authorizedIds: string[] = [];
  const unauthorizedIds: string[] = [];
  
  if (Array.isArray(conversationIds)) {
    // Check subscription limit
    if (client.messageConversations.size + conversationIds.length > MAX_CONVERSATION_SUBSCRIPTIONS) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `Subscription limit exceeded. Max ${MAX_CONVERSATION_SUBSCRIPTIONS} conversations per client.`,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // SECURITY: Verify user is a participant in each conversation before subscribing
    const { db: firestoreDb } = await import('./lib/firebase-admin');
    
    for (const convId of conversationIds) {
      try {
        const conversationDoc = await firestoreDb
          .collection('conversations')
          .doc(String(convId))
          .get();
        
        if (!conversationDoc.exists) {
          logger.warn(`[WebSocket] Client ${client.id} attempted to subscribe to non-existent conversation: ${convId}`);
          unauthorizedIds.push(String(convId));
          continue;
        }
        
        const conversationData = conversationDoc.data();
        const participants = conversationData?.participants || [];
        
        // Only allow subscription if user is a participant
        if (participants.includes(client.userId)) {
          client.messageConversations.add(String(convId));
          authorizedIds.push(String(convId));
        } else {
          logger.warn(`[WebSocket] Client ${client.id} (user ${client.userId}) attempted unauthorized subscription to conversation: ${convId}`);
          unauthorizedIds.push(String(convId));
        }
      } catch (error) {
        logger.error(`[WebSocket] Error verifying conversation ${convId} for client ${client.id}:`, error);
        unauthorizedIds.push(String(convId));
      }
    }
    
    if (authorizedIds.length > 0) {
      logger.info(`[WebSocket] Client ${client.id} (user ${client.userId}) subscribed to authorized conversations: ${authorizedIds.join(', ')}`);
    }
    
    if (unauthorizedIds.length > 0) {
      logger.warn(`[WebSocket] Client ${client.id} (user ${client.userId}) denied subscription to: ${unauthorizedIds.join(', ')}`);
    }
  }

  client.ws.send(JSON.stringify({
    type: 'conversations_subscribed',
    conversationIds: Array.from(client.messageConversations),
    authorizedIds,
    unauthorizedIds,
    timestamp: new Date().toISOString()
  }));
}

// Unsubscribe from conversations
function handleConversationUnsubscribe(client: ClientConnection, payload: any) {
  const { conversationIds } = payload || {};
  
  if (conversationIds === 'all') {
    client.messageConversations.clear();
  } else if (Array.isArray(conversationIds)) {
    conversationIds.forEach(convId => client.messageConversations.delete(String(convId)));
  }

  client.ws.send(JSON.stringify({
    type: 'conversations_unsubscribed',
    conversationIds: Array.from(client.messageConversations),
    timestamp: new Date().toISOString()
  }));
}

// Broadcast new message to conversation participants
export function broadcastNewMessage(conversationId: string, message: any, participantUids: string[]) {
  const payload = JSON.stringify({
    type: 'new_message',
    conversationId,
    message,
    timestamp: new Date().toISOString()
  });

  let deliveredCount = 0;
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN && client.userId) {
      // Send to participants who are subscribed to this conversation
      if (participantUids.includes(client.userId) && client.messageConversations.has(conversationId)) {
        client.ws.send(payload);
        deliveredCount++;
      }
    }
  });

  logger.info(`[WebSocket] Broadcasted message in conversation ${conversationId} to ${deliveredCount} connected clients`);
}

// Notify user about conversation update (unread count, etc.)
export function notifyConversationUpdate(userId: string, conversationId: string, update: any) {
  const payload = JSON.stringify({
    type: 'conversation_update',
    conversationId,
    update,
    timestamp: new Date().toISOString()
  });

  let deliveredCount = 0;
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN && client.userId === userId) {
      client.ws.send(payload);
      deliveredCount++;
    }
  });

  if (deliveredCount > 0) {
    logger.info(`[WebSocket] Notified user ${userId} about conversation ${conversationId} update`);
  }
}
