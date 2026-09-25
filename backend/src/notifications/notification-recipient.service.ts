import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { UserRole } from '../auth/enums/role.enum.js';

export interface RecipientResolutionInput {
  eventType: 'RM_SUBMITTED' | 'MATERIAL_ISSUED' | 'ADDITIONAL_MATERIAL_REQUESTED' | 'ADDITIONAL_REQUEST' | 'SC_COMPLETED' | string;
  actorUserId?: string;
  specificTargetUserId?: string;
}

@Injectable()
export class NotificationRecipientService {
  private readonly logger = new Logger(NotificationRecipientService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  /**
   * Resolves active users matching specific role names.
   * Only returns active users (is_active = true).
   */
  async findActiveUsersByRoles(roleNames: (UserRole | string)[]): Promise<User[]> {
    if (!roleNames || roleNames.length === 0) {
      return [];
    }

    const roles = await this.roleRepository.find({
      where: roleNames.map((name) => ({ name })),
    });

    if (!roles || roles.length === 0) {
      return [];
    }

    const roleIds = roles.map((r) => r.id);

    return await this.userRepository.find({
      where: {
        roleId: In(roleIds),
        isActive: true,
      },
      relations: { role: true },
    });
  }

  /**
   * Centralized Recipient Resolution Engine.
   * Derives authorized active recipients for business workflow events.
   */
  async resolveRecipients(input: RecipientResolutionInput): Promise<User[]> {
    const { eventType, actorUserId, specificTargetUserId } = input;
    this.logger.log(`Resolving recipients for event "${eventType}" (Actor: ${actorUserId || 'N/A'}, Target: ${specificTargetUserId || 'N/A'})`);

    let primaryRoles: (UserRole | string)[] = [];
    let monitoringRoles: (UserRole | string)[] = [];

    switch (eventType) {
      case 'RM_SUBMITTED':
        // Business Rule: Designer submits RM -> Stores handles operational fulfillment.
        primaryRoles = [UserRole.STORES];
        monitoringRoles = [];
        break;

      case 'MATERIAL_ISSUED':
        // Business Rule: Stores issues material -> Production receives material. Senior & General Managers monitor.
        primaryRoles = [UserRole.PRODUCTION];
        monitoringRoles = [UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER];
        break;

      case 'ADDITIONAL_MATERIAL_REQUESTED':
      case 'ADDITIONAL_REQUEST':
        // Business Rule: Production requests additional material -> Stores handles fulfillment. Senior & General Managers monitor.
        primaryRoles = [UserRole.STORES];
        monitoringRoles = [UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER];
        break;

      case 'SC_COMPLETED':
        // Business Rule: Production completes SC -> Designer receives operational notification. Senior & General Managers monitor.
        primaryRoles = [UserRole.DESIGNER];
        monitoringRoles = [UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER];
        break;

      default:
        this.logger.warn(`Unknown/unsupported event type "${eventType}". Returning empty recipient list.`);
        return [];
    }

    const recipientMap = new Map<string, User>();

    // 1. Resolve Specific Target User if provided (must be active)
    if (specificTargetUserId) {
      const specificUser = await this.userRepository.findOne({
        where: { id: specificTargetUserId, isActive: true },
        relations: { role: true },
      });
      if (specificUser) {
        recipientMap.set(specificUser.id, specificUser);
      }
    }

    // 2. Resolve Primary Operational Roles if specific user not resolved
    if (primaryRoles.length > 0 && recipientMap.size === 0) {
      const primaryUsers = await this.findActiveUsersByRoles(primaryRoles);
      for (const u of primaryUsers) {
        recipientMap.set(u.id, u);
      }
    }

    // 3. Resolve Monitoring Roles
    if (monitoringRoles.length > 0) {
      const monitoringUsers = await this.findActiveUsersByRoles(monitoringRoles);
      for (const u of monitoringUsers) {
        recipientMap.set(u.id, u);
      }
    }

    // 4. Exclude Actor (the user who performed the business action must not receive self-notification)
    if (actorUserId && recipientMap.has(actorUserId)) {
      this.logger.log(`Excluding actor "${actorUserId}" from notification recipient list for event "${eventType}"`);
      recipientMap.delete(actorUserId);
    }

    const finalRecipients = Array.from(recipientMap.values());
    this.logger.log(`Resolved ${finalRecipients.length} active recipient(s) for event "${eventType}"`);
    return finalRecipients;
  }
}
