# Database Design & Entity Relationships

## Target Schema Groupings (Phase 7 Reference)

```text
Identity Layer:
  User (id, email, password_hash, role_id, department, is_active)
  Role (id, name, description)
  Permission (id, resource, action)

Commercial & Context:
  Customer (id, name, code, contact_info)
  PurchaseOrder (id, po_number, customer_id, reference_date)
  SalesOrderComponent (id, sc_number, po_id, product_name, status)

Material Specification:
  RawMaterialRequirement (id, sc_id, material_grade, profile_type, size, required_qty, unit)
  MaterialAttribute (id, rm_id, attribute_name, attribute_value)

Transactional Movement:
  MaterialIssue (id, sc_id, rm_id, issue_qty, batch_number, issued_by, issued_at)
  ProductionReceipt (id, issue_id, received_qty, received_by, received_at)
  MaterialConsumption (id, sc_id, rm_id, consumed_qty, logged_by, logged_at)
  MaterialReturn (id, sc_id, rm_id, return_qty, returned_by, confirmed_by, status)
  AdditionalMaterialRequest (id, sc_id, rm_id, requested_qty, reason_code, status)

System & Compliance:
  Notification (id, user_id, title, message, is_read, trigger_event)
  AuditLog (id, entity_name, entity_id, actor_id, action_type, old_values, new_values, created_at)
```
