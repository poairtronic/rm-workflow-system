# Frontend Separation of Concerns Guidelines

## The 4-Tier Flow Rule

Never mix UI rendering, business/calculation logic, and HTTP networking in the same layer. Every feature must follow this strict 4-tier separation:

$$ \begin{matrix}
\text{1. UI Component} & \text{(Pure JSX, user interaction, prop callbacks)} \\
\downarrow & \\
\text{2. Feature Hook} & \text{(State, error handling, lifecycle orchestration)} \\
\downarrow & \\
\text{3. Feature Service} & \text{(Typed API requests via shared client)} \\
\downarrow & \\
\text{4. Backend API} & \text{(Authoritative math, DB transactions, role authorization)}
\end{matrix}$$

---

## Anti-Pattern (DO NOT DO THIS)
```tsx
// Bad: React component fetching directly and doing math
function BadButton() {
  const handleClick = async () => {
    const res = await fetch('/api/issue');
    const balance = res.issued - res.consumed; // Math in UI!
    await fetch('/api/update', { body: JSON.stringify({ balance }) });
  };
  return <button onClick={handleClick}>Submit</button>;
}
```

---

## Standard Reference Pattern (DO THIS)

### 1. Feature Service (`frontend/src/features/stores/services/index.ts`)
```ts
export const materialIssueService = {
  async submitMaterialIssue(payload: IssueMaterialPayload): Promise<MaterialIssueResult> {
    return api.post<MaterialIssueResult>('/api/material-issues', payload);
  },
};
```

### 2. Feature Hook (`frontend/src/features/stores/hooks/index.ts`)
```ts
export function useMaterialIssue() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issueMaterials = async (payload: IssueMaterialPayload) => {
    setLoading(true);
    try {
      return await materialIssueService.submitMaterialIssue(payload);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, issueMaterials };
}
```

### 3. UI Component (`frontend/src/features/stores/components/MaterialIssueForm.tsx`)
```tsx
export const MaterialIssueForm: React.FC<{ onSubmit: (p: IssuePayload) => void }> = ({ onSubmit }) => {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <Button type="submit">Confirm Issue</Button>
    </form>
  );
};
```

### 4. Page View (`frontend/src/features/stores/pages/MaterialIssuePage.tsx`)
```tsx
export function MaterialIssuePage() {
  const { issueMaterials, loading, error } = useMaterialIssue();
  return <MaterialIssueForm onSubmit={issueMaterials} loading={loading} error={error} />;
}
```
$$
