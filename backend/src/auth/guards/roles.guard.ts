import { CanActivate, ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { UserRole } from '../enums/role.enum.js';

interface CachedPerms {
  perms: Map<string, string>;
  expiresAt: number;
}

@Injectable()
export class RolesGuard implements CanActivate {
  private permCache = new Map<string, CachedPerms>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  constructor(
    private reflector: Reflector,
    @Optional() private dataSource?: DataSource,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    if (!user) {
      return false;
    }

    // Supports single role string or array of roles on user object
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles
      : user.role
        ? [user.role]
        : [];

    // 1. Admin role always has global access
    if (userRoles.includes(UserRole.ADMIN)) {
      return true;
    }

    // 2. Base role matches required roles
    if (requiredRoles.some((role) => userRoles.includes(role))) {
      return true;
    }

    // 3. Fallback for unit tests or unmanaged DB connections
    const userId = user.userId || user.id || user.sub;
    if (!this.dataSource || !userId) {
      return false;
    }

    // 4. Asynchronous custom module permission check
    return this.checkCustomModulePermissions(userId, req);
  }

  private async checkCustomModulePermissions(
    userId: string,
    req: any,
  ): Promise<boolean> {
    try {
      const rawUrl: string = req.originalUrl || req.baseUrl || req.url || req.path || '';
      const method: string = (req.method || 'GET').toUpperCase();
      const cleanPath = rawUrl.toLowerCase().split('?')[0];

      // Identify module keys associated with this API route
      const moduleKeys = this.getModuleKeysForPath(cleanPath);
      if (moduleKeys.length === 0) {
        return false;
      }

      // Check in-memory cache
      const now = Date.now();
      const cached = this.permCache.get(userId);
      let permMap: Map<string, string>;

      if (cached && cached.expiresAt > now) {
        permMap = cached.perms;
      } else {
        const query = `
          WITH user_ov AS (
            SELECT module_key, access_type
            FROM user_module_permissions
            WHERE user_id = $1
          ),
          role_def AS (
            SELECT rmp.module_key, 'FULL_ACCESS'::varchar as access_type
            FROM role_module_permissions rmp
            JOIN users u ON u.role_id = rmp.role_id
            WHERE u.id = $1 AND rmp.is_allowed = true
          )
          SELECT 
            COALESCE(uo.module_key, rd.module_key) as module_key,
            COALESCE(uo.access_type, rd.access_type) as access_type
          FROM role_def rd
          FULL OUTER JOIN user_ov uo ON rd.module_key = uo.module_key
        `;

        const rows: Array<{ module_key: string; access_type: string }> =
          await this.dataSource!.query(query, [userId]);

        permMap = new Map<string, string>();
        for (const row of rows || []) {
          permMap.set(row.module_key, row.access_type);
        }

        this.permCache.set(userId, { perms: permMap, expiresAt: now + this.CACHE_TTL_MS });
      }

      const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      // Check if any matching module key has FULL_ACCESS
      const hasFullAccess = moduleKeys.some(
        (key) => permMap.get(key) === 'FULL_ACCESS',
      );
      if (hasFullAccess) {
        return true;
      }

      // For read requests (GET), VIEW access is sufficient
      if (!isWriteMethod) {
        const hasViewAccess = moduleKeys.some(
          (key) => permMap.get(key) === 'VIEW',
        );
        if (hasViewAccess) {
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error('[RolesGuard] Custom module permissions check error:', err);
      return false;
    }
  }

  private getModuleKeysForPath(cleanPath: string): string[] {
    // 1. Users Master
    if (cleanPath.startsWith('/api/users') || cleanPath.startsWith('/permissions')) {
      return ['users_master', 'users'];
    }

    // 2. Vendors Master
    if (cleanPath.startsWith('/api/vendors')) {
      return ['vendors_master', 'vendors'];
    }

    // 3. Products Master (products, categories, families)
    if (
      cleanPath.startsWith('/api/products') ||
      cleanPath.startsWith('/api/categories') ||
      cleanPath.startsWith('/api/families')
    ) {
      return ['products_master', 'products'];
    }

    // 4. Warehouses & Bins Master (warehouses, bins, locations, racks)
    if (
      cleanPath.startsWith('/api/warehouses') ||
      cleanPath.startsWith('/api/bins') ||
      cleanPath.startsWith('/api/locations') ||
      cleanPath.startsWith('/api/racks')
    ) {
      return ['warehouses_master', 'warehouses'];
    }

    // 5. Process Master
    if (cleanPath.startsWith('/api/production-processes')) {
      return ['process_master', 'processes'];
    }

    // 6. Delivery Challan (Type 1, Type 2, Returns, Movements)
    if (cleanPath.startsWith('/api/delivery-challans')) {
      return ['dc_type1', 'dc_type2', 'dc_returns', 'dc_movements', 'delivery_challan'];
    }

    // 7. Consumables
    if (cleanPath.startsWith('/api/consumables')) {
      return ['consumables_requests', 'consumables_purchase_store'];
    }

    // 8. ECR Material Issues
    if (cleanPath.startsWith('/api/ecr-issues')) {
      return ['ecr_issues'];
    }

    // 9. MERC Indents
    if (cleanPath.startsWith('/api/merc-indents')) {
      return ['merc_indents'];
    }

    // 10. Quality & Rework
    if (cleanPath.startsWith('/api/rework')) {
      return ['quality_rework', 'rework_qc'];
    }

    // 11. Traceability
    if (cleanPath.startsWith('/api/traceability') || cleanPath.startsWith('/api/po')) {
      return ['sc_traceability', 'po_traceability'];
    }

    // 12. Inventory / Stock
    if (cleanPath.startsWith('/api/inventory')) {
      return ['stock_overview', 'stock_movements', 'supplier_inward', 'msl_alerts'];
    }

    // 13. RM Requisitions & Material Issue & Production
    if (
      cleanPath.startsWith('/api/rm') ||
      cleanPath.startsWith('/api/sc') ||
      cleanPath.startsWith('/api/material-issue') ||
      cleanPath.startsWith('/api/general-issue') ||
      cleanPath.startsWith('/api/additional-requests') ||
      cleanPath.startsWith('/api/production')
    ) {
      return [
        'rm_creation',
        'rm_requisitions',
        'my_requisitions',
        'rm_issue',
        'request_return_verify',
        'production_rm_verify',
        'production_request_return',
        'consumption',
      ];
    }

    // 14. Reports
    if (cleanPath.startsWith('/api/reports')) {
      return ['enterprise_reports'];
    }

    // 15. Audit Logs
    if (cleanPath.startsWith('/api/audit')) {
      return ['audit_logs'];
    }

    // 16. Communication
    if (cleanPath.startsWith('/api/email')) {
      return ['communication'];
    }

    return [];
  }
}
