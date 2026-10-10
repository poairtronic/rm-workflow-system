import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  RmRequest,
  RmRequestStatus,
  FormType,
} from './entities/rm-request.entity.js';
import { RmItem, AvailabilityStatus } from './entities/rm-item.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { CreateRmDto, CreateRmItemDto, SubmitRmDto } from './dto/rm.dto.js';
import { CreateDraftRmDto, UpdateDraftRmDto } from './dto/draft-rm.dto.js';
import { StoresReviewRmDto } from './dto/stores-review.dto.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';
import { StateMachineValidator } from '../common/utils/state-machine-validator.js';
import { WorkflowNotificationService } from '../notifications/workflow-notification.service.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { RmItemSnapshot, SnapshotChangeType } from './entities/rm-item-snapshot.entity.js';

@Injectable()
export class RmService {
  constructor(
    @InjectRepository(RmRequest)
    private readonly rmRepo: Repository<RmRequest>,
    @InjectRepository(RmItem)
    private readonly rmItemRepo: Repository<RmItem>,
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly workflowNotificationService?: WorkflowNotificationService,
  ) {}

  async createRm(dto: CreateRmDto, actorId: string) {
    const sc = await this.scRepo.findOneBy({ id: dto.scId });
    if (!sc) {
      throw new NotFoundException(
        `Sales Order Component with ID "${dto.scId}" not found.`,
      );
    }

    const existing = await this.rmRepo.findOne({
      where: { scId: dto.scId },
    });
    if (existing) {
      throw new BadRequestException(
        `RM Request already exists for SC ID "${dto.scId}".`,
      );
    }

    const rm = this.rmRepo.create({
      scId: dto.scId,
      formType: FormType.SC,
      createdById: actorId,
      status: RmRequestStatus.DRAFT,
      remarks: dto.remarks,
    });

    return this.rmRepo.save(rm);
  }

  async addRmItem(rmId: string, dto: CreateRmItemDto) {
    const rm = await this.rmRepo.findOne({
      where: { id: rmId },
      relations: { items: true, salesOrderComponent: true },
    });
    if (!rm) {
      throw new NotFoundException(`RM Request with ID "${rmId}" not found.`);
    }

    StateMachineValidator.assertRmDraft(rm.status, 'add items');

    const item = this.rmItemRepo.create({
      rmFormId: rm.id,
      scId: rm.scId || rm.salesOrderComponent?.id,
      material: dto.material.trim(),
      materialType: dto.materialType || 'ROUND_BAR',
      grade: dto.grade.trim(),
      quantity: QuantityCalculator.roundDecimal(dto.quantity),
      size: dto.size.trim(),
      length: dto.length,
      width: dto.width,
      thickness: dto.thickness,
      diameter: dto.diameter,
      weight: dto.weight,
      weightUnit: dto.weightUnit || 'KG',
      remarks: dto.remarks?.trim(),
    });

    return this.rmItemRepo.save(item);
  }

  async submitRm(rmId: string, dto?: SubmitRmDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const rm = await queryRunner.manager.findOne(RmRequest, {
        where: { id: rmId },
        lock: { mode: 'pessimistic_write' },
      });

      const rmWithRelations = await queryRunner.manager.findOne(RmRequest, {
        where: { id: rmId },
        relations: { items: true, salesOrderComponent: true },
      });

      if (rm) {
        Object.assign(rm, rmWithRelations);
      }

      if (!rm) {
        throw new NotFoundException(`RM Request with ID "${rmId}" not found.`);
      }

      if (!rm.items || rm.items.length === 0) {
        throw new BadRequestException(
          `Cannot submit an RM Request without any Material Items.`,
        );
      }

      StateMachineValidator.assertRmDraft(rm.status, 'submit RM Request');

      rm.status = RmRequestStatus.SUBMITTED;
      rm.submittedAt = new Date();
      if (dto?.remarks) {
        rm.remarks = `${rm.remarks || ''} [Submit: ${dto.remarks}]`;
      }

      if (rm.salesOrderComponent) {
        rm.salesOrderComponent.status = ScStatus.SUBMITTED;
        await queryRunner.manager.save(SalesOrderComponent, rm.salesOrderComponent);
      }

      await queryRunner.manager.save(RmRequest, rm);
      await queryRunner.commitTransaction();

      if (this.workflowNotificationService) {
        try {
          await this.workflowNotificationService.notifyRmSubmitted({
            id: rm.id,
            rmNumber: rm.salesOrderComponent?.scNumber || rm.id,
            createdById: rm.createdById,
          });
        } catch (err) {
        }
      }

      return this.findOne(rmId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query?: { scId?: string; status?: RmRequestStatus }, user?: any) {
    const qb = this.rmRepo
      .createQueryBuilder('rm')
      .leftJoinAndSelect('rm.salesOrderComponent', 'sc')
      .leftJoinAndSelect('rm.items', 'items')
      .leftJoinAndSelect('rm.createdBy', 'createdBy');

    if (query?.scId) {
      qb.andWhere('rm.scId = :scId', { scId: query.scId });
    }
    if (query?.status) {
      qb.andWhere('rm.status = :status', { status: query.status });
    }

    if (user && user.role !== UserRole.ADMIN && user.role !== UserRole.DESIGNER) {
       qb.andWhere('rm.status != :draftStatus', { draftStatus: RmRequestStatus.DRAFT });
    } else if (user && user.role === UserRole.DESIGNER) {
       qb.andWhere('(rm.status != :draftStatus OR rm.createdById = :userId)', { draftStatus: RmRequestStatus.DRAFT, userId: user.userId });
    }

    qb.orderBy('rm.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user?: any) {
    const rm = await this.rmRepo.findOne({
      where: { id },
      relations: {
        salesOrderComponent: { purchaseOrder: true },
        items: {
          materialIssues: true,
          materialConsumptions: true,
          materialReturns: true,
        },
        createdBy: true,
      },
    });

    if (!rm) {
      throw new NotFoundException(`RM Request with ID "${id}" not found.`);
    }

    if (user && user.role !== UserRole.ADMIN && user.role !== UserRole.DESIGNER && rm.status === RmRequestStatus.DRAFT) {
      throw new NotFoundException(`RM Request with ID "${id}" not found.`);
    }
    if (user && user.role === UserRole.DESIGNER && rm.status === RmRequestStatus.DRAFT && rm.createdById !== user.userId) {
      throw new NotFoundException(`RM Request with ID "${id}" not found.`);
    }

    return rm;
  }

  async reviewRm(rmId: string, dto: StoresReviewRmDto, actorId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const rm = await queryRunner.manager.findOne(RmRequest, {
        where: { id: rmId },
        lock: { mode: 'pessimistic_write' },
      });

      const rmWithRelations = await queryRunner.manager.findOne(RmRequest, {
        where: { id: rmId },
        relations: { items: true, salesOrderComponent: true },
      });

      if (rm) {
        Object.assign(rm, rmWithRelations);
        rm.salesOrderComponent = rmWithRelations?.salesOrderComponent;
      }
      if (!rm) {
        throw new NotFoundException(`RM Request with ID "${rmId}" not found.`);
      }

      if (
        rm.status !== RmRequestStatus.SUBMITTED &&
        rm.status !== RmRequestStatus.REVIEWED
      ) {
        throw new BadRequestException(
          `RM Request must be SUBMITTED to be reviewed. Current status: ${rm.status}`,
        );
      }

      for (const mapping of dto.itemMappings) {
        const item = rm.items.find((i) => i.id === mapping.rmItemId);
        if (!item) {
          throw new BadRequestException(
            `RM Item "${mapping.rmItemId}" does not belong to this RM Request.`,
          );
        }

        if (mapping.productId) {
          const balances = await queryRunner.manager.find(StockBalance, {
            where: { productId: mapping.productId },
          });

          const totalAvailable = balances.reduce(
            (sum, b) => sum + Number(b.currentQuantity),
            0,
          );
          const reqQty = Number(item.quantity);

          item.mappedProductId = mapping.productId;
          item.availableQuantitySnapshot = totalAvailable;

          if (totalAvailable >= reqQty) {
            item.availabilityStatus = AvailabilityStatus.AVAILABLE;
          } else if (totalAvailable > 0) {
            item.availabilityStatus = AvailabilityStatus.PARTIAL;
          } else {
            item.availabilityStatus = AvailabilityStatus.NOT_AVAILABLE;
          }
        } else {
          item.mappedProductId = undefined;
          item.availableQuantitySnapshot = 0;
          item.availabilityStatus = AvailabilityStatus.NOT_AVAILABLE;
        }

        await queryRunner.manager.save(RmItem, item);
      }

      rm.status = RmRequestStatus.REVIEWED;
      rm.reviewedAt = new Date();
      rm.reviewedById = actorId;
      if (dto.remarks) {
        rm.remarks = `${rm.remarks || ''} [Review: ${dto.remarks}]`;
      }
      
      if (rm.salesOrderComponent) {
        rm.salesOrderComponent.status = ScStatus.STORES_PENDING;
        await queryRunner.manager.save(SalesOrderComponent, rm.salesOrderComponent);
      }

      await queryRunner.manager.save(RmRequest, rm);
      await queryRunner.commitTransaction();

      return this.findOne(rmId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectRm(rmId: string, remarks: string, actorId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const rm = await queryRunner.manager.findOne(RmRequest, {
        where: { id: rmId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!rm) {
        throw new NotFoundException(`RM Request with ID "${rmId}" not found.`);
      }

      rm.salesOrderComponent =
        (await queryRunner.manager.findOne(SalesOrderComponent, {
          where: { id: rm.scId },
        })) || undefined;

      if (rm.status !== RmRequestStatus.SUBMITTED && rm.status !== RmRequestStatus.REVIEWED) {
        throw new BadRequestException(
          `Only SUBMITTED or REVIEWED requests can be rejected. Current status: ${rm.status}`,
        );
      }

      rm.status = RmRequestStatus.REJECTED;
      rm.remarks = `${rm.remarks || ''} [Rejected by Stores: ${remarks}]`.trim();
      if (rm.salesOrderComponent) {
        rm.salesOrderComponent.status = ScStatus.REJECTED;
        await queryRunner.manager.save(SalesOrderComponent, rm.salesOrderComponent);
      }

      await queryRunner.manager.save(RmRequest, rm);
      await queryRunner.commitTransaction();

      return this.findOne(rmId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // --- NEW DRAFT ENDPOINTS ---

  async createDraftRm(dto: CreateDraftRmDto, user: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { poNumber: dto.poNumber.trim() },
      });

      if (!po) {
        let customerId = dto.customerId;
        if (!customerId) {
          let defaultCustomer = await queryRunner.manager.findOne(Customer, {
            where: { code: 'BDL-IND' },
          });
          if (!defaultCustomer) {
            const existingCustomers = await queryRunner.manager.find(Customer, {
              order: { createdAt: 'ASC' },
              take: 1,
            });
            if (existingCustomers.length > 0) {
              defaultCustomer = existingCustomers[0];
            }
          }
          if (!defaultCustomer) {
            defaultCustomer = queryRunner.manager.create(Customer, {
              code: 'BDL-IND',
              name: 'Bharat Dynamics Limited',
            });
            defaultCustomer = await queryRunner.manager.save(defaultCustomer);
          }
          customerId = defaultCustomer.id;
        }
        po = queryRunner.manager.create(PurchaseOrder, {
          poNumber: dto.poNumber.trim(),
          customerId,
        });
        try {
          po = await queryRunner.manager.save(po);
        } catch (e: any) {
          if (e.code === '23505') { 
            po = await queryRunner.manager.findOne(PurchaseOrder, {
              where: { poNumber: dto.poNumber.trim() },
            });
            if (!po) throw e;
          } else {
            throw e;
          }
        }
      }

      for (const scDto of dto.scs) {
        const scNumber = scDto.scNumber.trim();
        let sc = await queryRunner.manager.findOne(SalesOrderComponent, {
          where: { poId: po.id, scNumber },
          relations: { rmRequest: true }
        });

        if (sc) {
          if (sc.rmRequest && sc.rmRequest.status !== RmRequestStatus.DRAFT && sc.rmRequest.status !== RmRequestStatus.REJECTED) {
            throw new ConflictException(`SC ${scNumber} already has an active RM Request.`);
          }
        } else {
          sc = queryRunner.manager.create(SalesOrderComponent, {
            poId: po.id,
            scNumber,
            productName: scDto.productName,
            status: ScStatus.DRAFT,
          });
          sc = await queryRunner.manager.save(sc);
        }

        let rm = await queryRunner.manager.findOne(RmRequest, {
          where: { scId: sc.id }
        });

        if (!rm) {
          rm = queryRunner.manager.create(RmRequest, {
            poId: po.id,
            scId: sc.id,
            createdById: user.userId,
            status: RmRequestStatus.DRAFT,
          });
          rm = await queryRunner.manager.save(rm);
        } else if (rm.status === RmRequestStatus.REJECTED) {
          rm.status = RmRequestStatus.DRAFT;
          await queryRunner.manager.delete(RmItem, { rmFormId: rm.id });
          rm = await queryRunner.manager.save(rm);
        } else if (rm.status !== RmRequestStatus.DRAFT) {
           throw new ConflictException(`SC ${scNumber} already has a non-DRAFT RM Request.`);
        }

        for (const itemDto of scDto.items) {
          const product = await queryRunner.manager.findOne(Product, { where: { id: itemDto.productId } });
          if (!product || !product.isActive) {
            throw new BadRequestException(`Product ${itemDto.productId} not found or inactive`);
          }

          const existingItem = await queryRunner.manager.findOne(RmItem, {
            where: { rmFormId: rm.id, mappedProductId: product.id }
          });
          if (existingItem) {
             throw new BadRequestException(`Duplicate product ${product.id} in SC ${scNumber}`);
          }

          const item = queryRunner.manager.create(RmItem, {
            rmFormId: rm.id,
            scId: sc.id,
            material: product.name,
            mappedProductId: product.id,
            materialType: 'ROUND_BAR',
            grade: itemDto.spec.trim(),
            size: itemDto.spec.trim(),
            quantity: QuantityCalculator.roundDecimal(itemDto.quantity),
          });
          await queryRunner.manager.save(item);
        }
      }

      await queryRunner.commitTransaction();
      console.log('[DEBUG] createDraftRm transaction committed');
      const res = await this.getDraftRmByPo(po!.id, user);
      return res;
    } catch (error) {
      console.log('[DEBUG] createDraftRm rolling back transaction', error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      console.log('[DEBUG] createDraftRm releasing queryRunner');
      await queryRunner.release();
      console.log('[DEBUG] createDraftRm queryRunner released');
    }
  }

  async getDraftRmByPo(poId: string, user: any) {
    // 1. Try to find draft or rejected RMs first
    const qb = this.rmRepo.createQueryBuilder('rm')
      .leftJoinAndSelect('rm.salesOrderComponent', 'sc')
      .leftJoinAndSelect('rm.items', 'items')
      .leftJoinAndSelect('rm.purchaseOrder', 'po')
      .where('rm.po_id = :poId', { poId })
      .andWhere('rm.status IN (:...statuses)', { statuses: [RmRequestStatus.DRAFT, RmRequestStatus.REJECTED] });
      
    if (user.role !== UserRole.ADMIN) {
      qb.andWhere('rm.created_by_id = :userId', { userId: user.userId });
    }

    let records = await qb.getMany();

    // 2. If no draft or rejected RM found, check if ANY RM exists for this PO (e.g. SUBMITTED, REVIEWED)
    if (!records.length) {
      const allRmQb = this.rmRepo.createQueryBuilder('rm')
        .leftJoinAndSelect('rm.salesOrderComponent', 'sc')
        .leftJoinAndSelect('rm.items', 'items')
        .leftJoinAndSelect('rm.purchaseOrder', 'po')
        .where('rm.po_id = :poId', { poId });

      if (user.role !== UserRole.ADMIN) {
        allRmQb.andWhere('rm.created_by_id = :userId', { userId: user.userId });
      }
      records = await allRmQb.getMany();
    }

    // 3. Fallback: check if the PO exists directly
    const po = (records.length > 0 && records[0].purchaseOrder)
      ? records[0].purchaseOrder
      : await this.dataSource.getRepository(PurchaseOrder).findOne({ where: { id: poId } });

    if (!po && !records.length) return null;

    return {
       poId: po ? po.id : poId,
       poNumber: po ? po.poNumber : '',
       scs: records.map(rm => ({
         scId: rm.scId,
         scNumber: rm.salesOrderComponent?.scNumber || '',
         productName: rm.salesOrderComponent?.productName || '',
         status: rm.status,
         remarks: rm.remarks,
         items: (rm.items || []).map(i => ({
           id: i.id,
           productId: i.mappedProductId,
           spec: i.grade,
           quantity: i.quantity,
           material: i.material
         }))
       }))
    };
  }

  async updateDraftRm(poId: string, dto: UpdateDraftRmDto, user: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const po = await queryRunner.manager.findOne(PurchaseOrder, { where: { id: poId } });
      if (!po) throw new NotFoundException('PO not found');

      const isOwner = user.role === UserRole.DESIGNER;
      const ownerCond = isOwner ? { createdById: user.userId } : {};

      const existingDrafts = await queryRunner.manager.find(RmRequest, {
         where: [
           { poId, status: RmRequestStatus.DRAFT, ...ownerCond },
           { poId, status: RmRequestStatus.REJECTED, ...ownerCond },
         ],
         relations: { salesOrderComponent: true, items: true }
      });

      const inputScNumbers = dto.scs.map(sc => sc.scNumber.trim());

      for (const draft of existingDrafts) {
        if (!inputScNumbers.includes(draft.salesOrderComponent!.scNumber)) {
          await queryRunner.manager.delete(RmItem, { rmFormId: draft.id });
          await queryRunner.manager.delete(RmRequest, { id: draft.id });
          await queryRunner.manager.delete(SalesOrderComponent, { id: draft.scId });
        }
      }

      for (const scDto of dto.scs) {
        const scNumber = scDto.scNumber.trim();
        let draft = existingDrafts.find(d => d.salesOrderComponent!.scNumber === scNumber);

        let sc;
        if (draft) {
          sc = draft.salesOrderComponent!;
          sc.productName = scDto.productName;
          sc.status = ScStatus.DRAFT;
          draft.status = RmRequestStatus.DRAFT;
          await queryRunner.manager.save(sc);
          await queryRunner.manager.save(draft);
          await queryRunner.manager.delete(RmItem, { rmFormId: draft.id });
        } else {
          console.log(`[DEBUG] updateDraftRm finding SC ${scNumber} for PO ${po.id}`);
          sc = await queryRunner.manager.findOne(SalesOrderComponent, {
            where: { poId: po.id, scNumber },
            relations: { rmRequest: true }
          });
          console.log(`[DEBUG] updateDraftRm found SC:`, sc?.id);
          if (sc) {
            if (sc.rmRequest && sc.rmRequest.status !== RmRequestStatus.DRAFT) {
              console.log(`[DEBUG] throwing ConflictException for SC ${scNumber}`);
              throw new ConflictException(`SC ${scNumber} already has a non-DRAFT RM Request.`);
            } else if (sc.rmRequest) {
               if (isOwner && sc.rmRequest.createdById !== user.userId) {
                  throw new ConflictException(`SC ${scNumber} draft belongs to another user.`);
               }
               draft = sc.rmRequest;
               sc.productName = scDto.productName;
               await queryRunner.manager.save(sc);
               await queryRunner.manager.delete(RmItem, { rmFormId: draft.id });
            }
          } else {
            sc = queryRunner.manager.create(SalesOrderComponent, {
              poId: po.id,
              scNumber,
              productName: scDto.productName,
              status: ScStatus.DRAFT,
            });
            sc = await queryRunner.manager.save(sc);
          }

          if (!draft) {
            draft = queryRunner.manager.create(RmRequest, {
              poId: po.id,
              scId: sc.id,
              createdById: isOwner ? user.userId : (sc.rmRequest?.createdById || user.userId),
              status: RmRequestStatus.DRAFT,
            });
            draft = await queryRunner.manager.save(draft);
          }
        }

        for (const itemDto of scDto.items) {
          const product = await queryRunner.manager.findOne(Product, { where: { id: itemDto.productId } });
          if (!product || !product.isActive) {
            throw new BadRequestException(`Product ${itemDto.productId} not found or inactive`);
          }

          const existingItem = await queryRunner.manager.findOne(RmItem, {
            where: { rmFormId: draft.id, mappedProductId: product.id }
          });
          if (existingItem) {
             throw new BadRequestException(`Duplicate product ${product.id} in SC ${scNumber}`);
          }

          const item = queryRunner.manager.create(RmItem, {
            rmFormId: draft.id,
            scId: sc!.id,
            material: product.name,
            mappedProductId: product.id,
            materialType: 'ROUND_BAR',
            grade: itemDto.spec.trim(),
            size: itemDto.spec.trim(),
            quantity: QuantityCalculator.roundDecimal(itemDto.quantity),
          });
          await queryRunner.manager.save(item);
        }
      }

      await queryRunner.commitTransaction();
      console.log('[DEBUG] updateDraftRm transaction committed');
      const res = await this.getDraftRmByPo(poId, user);
      return res;
    } catch (error) {
      console.log('[DEBUG] updateDraftRm rolling back transaction');
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      console.log('[DEBUG] updateDraftRm releasing queryRunner');
      await queryRunner.release();
      console.log('[DEBUG] updateDraftRm queryRunner released');
    }
  }

  async submitDraftRmByPo(poId: string, user: any) {
    let result: any;
    const queryRunner = this.dataSource.createQueryRunner();
    console.log('[DEBUG] submitDraftRmByPo connecting...');
    await queryRunner.connect();
    console.log('[DEBUG] submitDraftRmByPo starting transaction...');
    await queryRunner.startTransaction();

    try {
      const isOwner = user.role === UserRole.DESIGNER;
      const ownerCond = isOwner ? { createdById: user.userId } : {};

      const qb = queryRunner.manager.createQueryBuilder(RmRequest, 'rm')
        .select('rm.id')
        .where('rm.po_id = :poId', { poId })
        .andWhere('rm.status = :status', { status: RmRequestStatus.DRAFT });
      if (isOwner) {
        qb.andWhere('rm.created_by_id = :userId', { userId: user.userId });
      }
      qb.setLock('pessimistic_write');
      console.log('[DEBUG] submitDraftRmByPo getting lock...');
      const draftsToLock = await qb.getMany();
      console.log('[DEBUG] submitDraftRmByPo lock acquired');

      const drafts = await queryRunner.manager.find(RmRequest, {
         where: { poId, status: RmRequestStatus.DRAFT, ...ownerCond },
         relations: { salesOrderComponent: true, items: true }
      });

      if (!drafts.length) {
        throw new BadRequestException('No DRAFT RM Requests found for this PO.');
      }

      const submittedScs: string[] = [];
      const draftsToSave: RmRequest[] = [];
      const scsToSave: SalesOrderComponent[] = [];
      const snapsToSave: RmItemSnapshot[] = [];

      for (const draft of drafts) {
        if (!draft.items || draft.items.length === 0) {
          throw new BadRequestException(`Cannot submit RM for SC ${draft.salesOrderComponent!.scNumber} without items.`);
        }

        draft.status = RmRequestStatus.SUBMITTED;
        draft.submittedAt = new Date();
        draft.salesOrderComponent!.status = ScStatus.SUBMITTED;
        
        scsToSave.push(draft.salesOrderComponent!);
        draftsToSave.push(draft);

        for (const item of draft.items) {
          const snap = queryRunner.manager.create(RmItemSnapshot, {
            rmItemId: item.id,
            rmFormId: draft.id,
            revisionNumber: 1,
            changeType: SnapshotChangeType.ORIGINAL_SUBMISSION,
            changedById: user.userId,
            material: item.material,
            materialType: item.materialType,
            grade: item.grade,
            quantity: item.quantity,
            size: item.size,
            length: item.length,
            width: item.width,
            thickness: item.thickness,
            diameter: item.diameter,
            weight: item.weight,
            weightUnit: item.weightUnit,
          });
          snapsToSave.push(snap);
        }

        submittedScs.push(draft.salesOrderComponent!.scNumber);
      }

      await queryRunner.manager.save(SalesOrderComponent, scsToSave);
      await queryRunner.manager.save(RmRequest, draftsToSave);
      if (snapsToSave.length > 0) {
        await queryRunner.manager.save(RmItemSnapshot, snapsToSave);
      }

      await queryRunner.commitTransaction();
      console.log('[DEBUG] submitDraftRmByPo transaction committed');

      result = { 
        submittedScs, 
        draftId: drafts[0].id, 
        createdById: drafts[0].createdById 
      };
    } catch (error) {
      console.log('[DEBUG] submitDraftRmByPo rolling back transaction');
      if (queryRunner.isTransactionActive) {
         await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      console.log('[DEBUG] submitDraftRmByPo releasing queryRunner');
      await queryRunner.release();
      console.log('[DEBUG] submitDraftRmByPo queryRunner released');
    }

    if (this.workflowNotificationService && result) {
      // Do not wait for notifications (fire and forget)
      this.workflowNotificationService.notifyRmSubmitted({
        id: result.draftId,
        rmNumber: `SCs: ${result.submittedScs.join(', ')}`,
        createdById: result.createdById,
      }).catch(err => {
        console.error('[ERROR] Failed to send notifications', err);
      });
    }

    return { submittedScs: result.submittedScs };
  }

  async getMine(user: any) {
    const isOwner = user.role === UserRole.DESIGNER;
    const ownerCond = isOwner ? { createdById: user.userId } : {};

    const requests = await this.rmRepo.find({
      where: ownerCond,
      relations: { salesOrderComponent: { purchaseOrder: true }, items: true },
      order: { updatedAt: 'DESC' }
    });

    const grouped = new Map<string, any>();
    
    for (const req of requests) {
      const po = req.salesOrderComponent?.purchaseOrder;
      if (!po) continue;

      if (!grouped.has(po.id)) {
        grouped.set(po.id, {
          poId: po.id,
          poNumber: po.poNumber,
          draftCount: 0,
          submittedCount: 0,
          rejectedCount: 0,
          scs: [],
          updatedAt: po.updatedAt,
        });
      }

      const group = grouped.get(po.id);
      
      if (req.status === RmRequestStatus.DRAFT) group.draftCount++;
      else if (req.status === RmRequestStatus.REJECTED) group.rejectedCount++;
      else group.submittedCount++;

      group.scs.push({
        scId: req.salesOrderComponent!.id,
        scNumber: req.salesOrderComponent!.scNumber,
        productName: req.salesOrderComponent!.productName,
        status: req.status,
        remarks: req.remarks,
        itemCount: req.items?.length || 0,
        items: (req.items || []).map((it) => ({
          id: it.id,
          material: it.material,
          grade: it.grade,
          quantity: it.quantity,
          size: it.size,
        })),
      });

      if (req.updatedAt > group.updatedAt) group.updatedAt = req.updatedAt;
    }

    return Array.from(grouped.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getStoresQueue() {
    const requests = await this.rmRepo.find({
      where: {
        status: In([
          RmRequestStatus.SUBMITTED,
          RmRequestStatus.REVIEWED,
          RmRequestStatus.COMPLETED,
        ]),
      },
      relations: { salesOrderComponent: { purchaseOrder: true }, items: true },
      order: { updatedAt: 'DESC' },
    });

    const grouped = new Map<string, any>();
    
    for (const req of requests) {
      const po = req.salesOrderComponent?.purchaseOrder;
      if (!po) continue;

      if (!grouped.has(po.id)) {
        grouped.set(po.id, {
          poId: po.id,
          poNumber: po.poNumber,
          scs: [],
          updatedAt: po.updatedAt,
        });
      }

      const group = grouped.get(po.id);
      
      group.scs.push({
        rmId: req.id,
        scId: req.salesOrderComponent!.id,
        scNumber: req.salesOrderComponent!.scNumber,
        productName: req.salesOrderComponent!.productName,
        status: req.status,
        scStatus: req.salesOrderComponent!.status,
        itemCount: req.items.length
      });

      if (req.updatedAt > group.updatedAt) group.updatedAt = req.updatedAt;
    }

    return Array.from(grouped.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async deleteRm(id: string, user: any) {
    const rm = await this.rmRepo.findOne({ where: { id }, relations: { salesOrderComponent: true } });
    if (!rm) throw new NotFoundException('RM not found');
    if (user.role === UserRole.DESIGNER && rm.createdById !== user.userId) throw new NotFoundException('RM not found');
    
    StateMachineValidator.assertRmDraft(rm.status, 'delete RM');
    
    await this.rmRepo.remove(rm);
    if (rm.salesOrderComponent && rm.salesOrderComponent.status === ScStatus.DRAFT) {
      await this.scRepo.remove(rm.salesOrderComponent);
    }
    return { success: true };
  }

  async deleteRmItem(id: string, itemId: string, user: any) {
    const rm = await this.rmRepo.findOne({ where: { id } });
    if (!rm) throw new NotFoundException('RM not found');
    if (user.role === UserRole.DESIGNER && rm.createdById !== user.userId) throw new NotFoundException('RM not found');
    StateMachineValidator.assertRmDraft(rm.status, 'delete RM item');

    const item = await this.rmItemRepo.findOne({ where: { id: itemId, rmFormId: id } });
    if (!item) throw new NotFoundException('Item not found');

    await this.rmItemRepo.remove(item);
    return { success: true };
  }

  async updateRmItem(id: string, itemId: string, dto: any, user: any) {
    const rm = await this.rmRepo.findOne({ where: { id } });
    if (!rm) throw new NotFoundException('RM not found');
    if (user.role === UserRole.DESIGNER && rm.createdById !== user.userId) throw new NotFoundException('RM not found');
    StateMachineValidator.assertRmDraft(rm.status, 'update RM item');

    const item = await this.rmItemRepo.findOne({ where: { id: itemId, rmFormId: id } });
    if (!item) throw new NotFoundException('Item not found');

    if (dto.quantity !== undefined) item.quantity = QuantityCalculator.roundDecimal(dto.quantity);
    if (dto.spec !== undefined) {
      item.grade = dto.spec.trim();
      item.size = dto.spec.trim();
    }

    return this.rmItemRepo.save(item);
  }
}
