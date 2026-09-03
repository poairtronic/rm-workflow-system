/**
 * Material Reconciliation Calculator for Sales Order Components (SC)
 * Provides comprehensive lifecycle ledger analytics across all material stages.
 */

export interface MaterialLineReconciliation {
  rmItemId: string;
  material: string;
  grade: string;
  size: string;
  unit: string;
  requestedQuantity: number;
  initialIssuedQuantity: number;
  additionalIssuedQuantity: number;
  totalIssuedQuantity: number;
  receivedQuantity: number;
  consumedQuantity: number;
  returnedQuantity: number;
  scrapOrUnaccountedQuantity: number;
  isFullyBalanced: boolean;
  status: 'BALANCED' | 'SCRAP_LOGGED' | 'IN_PRODUCTION' | 'SHORTAGE';
}

export interface ScMaterialReconciliationReport {
  scId: string;
  scNumber: string;
  productName: string;
  scStatus: string;
  completedAt?: Date;
  lines: MaterialLineReconciliation[];
  summary: {
    totalItems: number;
    totalRequested: number;
    totalIssued: number;
    totalReceived: number;
    totalConsumed: number;
    totalReturned: number;
    totalScrapOrLoss: number;
  };
}

export class MaterialReconciliationUtil {
  /**
   * Reconciles raw material ledger for a single line item
   */
  static reconcileLine(params: {
    rmItemId: string;
    material: string;
    grade: string;
    size: string;
    unit?: string;
    requestedQuantity: number;
    initialIssuedQuantity: number;
    additionalIssuedQuantity?: number;
    receivedQuantity: number;
    consumedQuantity: number;
    returnedQuantity: number;
  }): MaterialLineReconciliation {
    const additionalIssued = params.additionalIssuedQuantity || 0;
    const totalIssued = Number(
      (params.initialIssuedQuantity + additionalIssued).toFixed(3),
    );
    const accounted = Number(
      (params.consumedQuantity + params.returnedQuantity).toFixed(3),
    );
    const scrapOrUnaccounted = Number(
      Math.max(0, params.receivedQuantity - accounted).toFixed(3),
    );
    const isFullyBalanced = accounted === params.receivedQuantity;

    let status: 'BALANCED' | 'SCRAP_LOGGED' | 'IN_PRODUCTION' | 'SHORTAGE' =
      'BALANCED';

    if (totalIssued < params.requestedQuantity) {
      status = 'SHORTAGE';
    } else if (scrapOrUnaccounted > 0) {
      status = 'SCRAP_LOGGED';
    } else if (!isFullyBalanced) {
      status = 'IN_PRODUCTION';
    }

    return {
      rmItemId: params.rmItemId,
      material: params.material,
      grade: params.grade,
      size: params.size,
      unit: params.unit || 'KG',
      requestedQuantity: params.requestedQuantity,
      initialIssuedQuantity: params.initialIssuedQuantity,
      additionalIssuedQuantity: additionalIssued,
      totalIssuedQuantity: totalIssued,
      receivedQuantity: params.receivedQuantity,
      consumedQuantity: params.consumedQuantity,
      returnedQuantity: params.returnedQuantity,
      scrapOrUnaccountedQuantity: scrapOrUnaccounted,
      isFullyBalanced,
      status,
    };
  }

  /**
   * Aggregates line items into a full SC reconciliation report
   */
  static generateScReport(
    sc: {
      id: string;
      scNumber: string;
      productName: string;
      status: string;
      completedAt?: Date;
    },
    lines: MaterialLineReconciliation[],
  ): ScMaterialReconciliationReport {
    const summary = lines.reduce(
      (acc, line) => {
        acc.totalRequested += line.requestedQuantity;
        acc.totalIssued += line.totalIssuedQuantity;
        acc.totalReceived += line.receivedQuantity;
        acc.totalConsumed += line.consumedQuantity;
        acc.totalReturned += line.returnedQuantity;
        acc.totalScrapOrLoss += line.scrapOrUnaccountedQuantity;
        return acc;
      },
      {
        totalItems: lines.length,
        totalRequested: 0,
        totalIssued: 0,
        totalReceived: 0,
        totalConsumed: 0,
        totalReturned: 0,
        totalScrapOrLoss: 0,
      },
    );

    return {
      scId: sc.id,
      scNumber: sc.scNumber,
      productName: sc.productName,
      scStatus: sc.status,
      completedAt: sc.completedAt,
      lines,
      summary: {
        totalItems: summary.totalItems,
        totalRequested: Number(summary.totalRequested.toFixed(3)),
        totalIssued: Number(summary.totalIssued.toFixed(3)),
        totalReceived: Number(summary.totalReceived.toFixed(3)),
        totalConsumed: Number(summary.totalConsumed.toFixed(3)),
        totalReturned: Number(summary.totalReturned.toFixed(3)),
        totalScrapOrLoss: Number(summary.totalScrapOrLoss.toFixed(3)),
      },
    };
  }
}
