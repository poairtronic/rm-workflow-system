import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { GeneralIssue, GeneralIssueStatus } from '../general-issue/entities/general-issue.entity.js';
import { GeneralIssueItem } from '../general-issue/entities/general-issue-item.entity.js';

describe('GeneralIssue Schema & Relation Metadata (Phase 17.2)', () => {
  it('verifies GeneralIssue entity contains optional sc_id and po_id columns', () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((col) => {
        const targetName = typeof col.target === 'function' ? col.target.name : '';
        return targetName === GeneralIssue.name;
      })
      .map((col) => ({
        propertyName: col.propertyName,
        options: col.options,
      }));

    const scIdCol = columns.find((c) => c.propertyName === 'scId');
    const poIdCol = columns.find((c) => c.propertyName === 'poId');

    expect(scIdCol).toBeDefined();
    expect(scIdCol?.options.name).toBe('sc_id');
    expect(scIdCol?.options.nullable).toBe(true);

    expect(poIdCol).toBeDefined();
    expect(poIdCol?.options.name).toBe('po_id');
    expect(poIdCol?.options.nullable).toBe(true);
  });

  it('verifies indices exist for sc_id and po_id', () => {
    const indices = getMetadataArgsStorage()
      .indices.filter((idx) => {
        const targetName = typeof idx.target === 'function' ? idx.target.name : '';
        return targetName === GeneralIssue.name;
      })
      .map((idx) => ({
        name: idx.name,
        columns: (idx.columns || []).map((col) =>
          typeof col === 'string' ? col : col.propertyName,
        ),
      }));

    const scIndex = indices.find(
      (i) => i.columns.includes('scId') || i.name === 'IDX_general_issues_sc_id',
    );
    const poIndex = indices.find(
      (i) => i.columns.includes('poId') || i.name === 'IDX_general_issues_po_id',
    );

    expect(scIndex).toBeDefined();
    expect(poIndex).toBeDefined();
  });

  it('verifies ManyToOne relations to SalesOrderComponent and PurchaseOrder are optional', () => {
    const relations = getMetadataArgsStorage()
      .relations.filter((rel) => {
        const targetName = typeof rel.target === 'function' ? rel.target.name : '';
        return targetName === GeneralIssue.name;
      })
      .map((rel) => ({
        propertyName: rel.propertyName,
        relationType: rel.relationType,
        isNullable: rel.options.nullable,
      }));

    const scRel = relations.find((r) => r.propertyName === 'salesOrderComponent');
    const poRel = relations.find((r) => r.propertyName === 'purchaseOrder');

    expect(scRel).toBeDefined();
    expect(scRel?.relationType).toBe('many-to-one');
    expect(scRel?.isNullable).toBe(true);

    expect(poRel).toBeDefined();
    expect(poRel?.relationType).toBe('many-to-one');
    expect(poRel?.isNullable).toBe(true);
  });

  it('verifies GeneralIssueStatus enum contains ISSUED and CANCELLED', () => {
    expect(GeneralIssueStatus.ISSUED).toBe('ISSUED');
    expect(GeneralIssueStatus.CANCELLED).toBe('CANCELLED');
  });

  it('verifies GeneralIssueItem contains required product and bin relations', () => {
    const relations = getMetadataArgsStorage()
      .relations.filter((rel) => {
        const targetName = typeof rel.target === 'function' ? rel.target.name : '';
        return targetName === GeneralIssueItem.name;
      })
      .map((rel) => ({
        propertyName: rel.propertyName,
        relationType: rel.relationType,
      }));

    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyName: 'generalIssue', relationType: 'many-to-one' }),
        expect.objectContaining({ propertyName: 'product', relationType: 'many-to-one' }),
        expect.objectContaining({ propertyName: 'bin', relationType: 'many-to-one' }),
      ]),
    );
  });
});
