import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { AdditionalMaterialRequest } from '../additional-request/entities/additional-request.entity.js';
import { AdditionalMaterialRequestItem } from '../additional-request/entities/additional-request-item.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';

describe('dashboard request index coverage', () => {
  it('adds composite indexes for request dashboard filtering and ordering', () => {
    const indices = getMetadataArgsStorage()
      .indices.filter((index) => {
        const targetName = typeof index.target === 'function' ? index.target.name : '';
        return [
          AdditionalMaterialRequest.name,
          AdditionalMaterialRequestItem.name,
          RmRequest.name,
        ].includes(targetName);
      })
      .map((index) => ({
        name: index.name,
        target: typeof index.target === 'function' ? index.target.name : '',
        columns: (index.columns || []).map((column) =>
          typeof column === 'string' ? column : column.propertyName,
        ),
      }));

    expect(indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_additional_material_requests_status_created_at',
          target: AdditionalMaterialRequest.name,
          columns: ['status', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'IDX_additional_material_request_items_request_created_at',
          target: AdditionalMaterialRequestItem.name,
          columns: ['requestId', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'IDX_rm_requests_status_created_at',
          target: RmRequest.name,
          columns: ['status', 'createdAt'],
        }),
      ]),
    );
  });
});
