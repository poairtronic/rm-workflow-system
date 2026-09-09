# PHASE 1 REQUIREMENT DECISION LOG

The following business decisions remain unresolved and must be explicitly answered by the project owner before finalizing the relevant implementation features.

1. **Exact Product -> Warehouse Relationship**: Can one product be distributed across multiple warehouses simultaneously, and if so, do we track balance per warehouse or globally?
2. **Exact Product -> Location Relationship**: Must stock balances be tracked down to the exact Warehouse Location level, or is Location just a visual tag?
3. **Rack/Bin Relationship**: 
   - Is a Rack part of a Location, and a Bin part of a Rack?
   - Can one Product exist in multiple Bins?
   - Can one Bin contain multiple Products?
4. **Exact Stock Ownership Level**: 
   - Does RM creation decrement available stock (reservation), or does ONLY physical Stores Issue reduce stock?
   - If Production rejects material before receipt, what is the accounting rollback?
5. **Return Verification Rule**: What happens to material physically if Stores rejects a Production Return?
6. **Minimum/Maximum Alert Behavior**: 
   - When Maximum Inventory is exceeded, is it a warning or a hard block on Stock In?
   - Are Min/Max alerts realtime pushes, daily digest emails, or dashboard badges?
7. **New Product Creation Authority**: Which role is permitted to create new Master Products, Categories, and Families?
8. **Exact Notification Recipients**: Who exactly receives RM submission alerts, low stock alerts, and production completion alerts?
9. **Exact Email Events**: Which business events require external SMTP emails versus in-app notifications?
