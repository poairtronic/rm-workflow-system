import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth?.token;
      if (!token && client.handshake.headers?.authorization) {
        const parts = client.handshake.headers.authorization.split(' ');
        token = parts.length === 2 ? parts[1] : client.handshake.headers.authorization;
      }
      if (!token && client.handshake.query?.token) {
        token = client.handshake.query.token as string;
      }

      if (!token) {
        this.logger.debug(`Socket client ${client.id} disconnected: No auth token provided`);
        client.disconnect(true);
        return;
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') || 'your_development_secret';
      const payload = this.jwtService.verify(token, { secret });

      const userId = payload.sub || payload.id || payload.userId;
      const role = payload.role;

      if (!userId) {
        this.logger.debug(`Socket client ${client.id} disconnected: Invalid token payload`);
        client.disconnect(true);
        return;
      }

      client.data.user = { userId, role, email: payload.email, name: payload.name };

      // Join user-specific room for targeted notifications
      await client.join(`user:${userId}`);

      // Join role-specific room if available
      if (role) {
        await client.join(`role:${role}`);
      }

      this.logger.log(`Socket client connected: ${client.id} (User: ${userId}, Role: ${role || 'N/A'})`);
    } catch (err: any) {
      this.logger.warn(`Socket connection rejected for ${client.id}: ${err?.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  /**
   * Emits a real-time notification to a specific user room
   */
  sendNotificationToUser(userId: string, notification: any) {
    if (!this.server) {
      this.logger.warn(`Cannot emit notification to user ${userId}: WebSocketServer not ready`);
      return;
    }
    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.debug(`Emitted notification to user:${userId} (Notification ID: ${notification?.id || 'new'})`);
  }

  /**
   * Emits a real-time notification to an entire role room
   */
  sendNotificationToRole(role: string, notification: any) {
    if (!this.server) {
      this.logger.warn(`Cannot emit notification to role ${role}: WebSocketServer not ready`);
      return;
    }
    this.server.to(`role:${role}`).emit('notification', notification);
    this.logger.debug(`Emitted notification to role:${role}`);
  }

  /**
   * Emits real-time unread count update to a specific user
   */
  sendUnreadCountToUser(userId: string, count: number) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit('notification:unread-count', { count });
    this.logger.debug(`Emitted unread count ${count} to user:${userId}`);
  }

  /**
   * Broadcasts an event to all connected clients
   */
  broadcast(event: string, data: any) {
    if (!this.server) return;
    this.server.emit(event, data);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    return { event: 'pong', data: { timestamp: new Date().toISOString(), echo: data } };
  }
}
