# Field Component Contract

**Version:** 1.0
**Applies to:** All form field components in `src/components/crud/fields/`

---

## Integration Contract

Every field component must satisfy this contract to work with React Hook Form + Zod:

### 1. Registration

Every field accepts a `registration` prop returned by RHF's `register()`:

```ts
registration: ReturnType<UseFormRegister<FieldValues>>
// usage: <TextField registration={register('name')} />
```

The component applies `{...registration}` to the underlying input element.

### 2. Error Display

Every field accepts an optional `error` prop (RHF's `FieldError` or string):

```ts
error?: FieldError | string;
```

When present:
- The field border changes to destructive color
- The error message renders below the field in `text-xs text-destructive`
- Animation: fade-in from y: -4px

### 3. Required/Optional

Every field accepts a `required` boolean prop (default `false`):

```ts
required?: boolean;
```

When `true`: appends a red asterisk `*` to the label.

### 4. Props Shape

All field components share this base:

```ts
interface BaseFieldProps {
  label: string;
  registration: ReturnType<UseFormRegister<FieldValues>>;
  error?: FieldError | string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

### 5. Styling

- **Layout:** `space-y-2` container with `<Label>` + input + conditional error message
- **Input:** `h-10 rounded-lg border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] text-[#111827] dark:text-[#FAFAFA]`
- **Focus:** `focus:outline-none focus:ring-2 focus:ring-[#8EF24A]/50`
- **Error:** `border-destructive focus-visible:ring-destructive`
- **Label:** `text-sm font-medium text-[#111827] dark:text-[#FAFAFA]`

---

## Available Fields

| Field | Underlying Element | Extra Props |
|---|---|---|
| `TextField` | `<input type="text">` | — |
| `EmailField` | `<input type="email">` | — |
| `PasswordField` | `<input type="password">` | `showToggle?: boolean` |
| `SelectField` | `<select>` | `options: { value: string; label: string }[]` |
| `DateField` | `<input type="date">` | — |
| `TextareaField` | `<textarea>` | `rows?: number` |
| `CheckboxField` | `<input type="checkbox">` | `description?: string` |
| `SwitchField` | Custom switch | `description?: string` |

---

## Example Usage

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, SelectField, DateField } from '@/components/crud/fields';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['A', 'B']),
  startDate: z.string().min(1, 'Date is required'),
});

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TextField
        label="Name"
        registration={register('name')}
        error={errors.name}
        required
        placeholder="Enter name"
      />
      <SelectField
        label="Type"
        registration={register('type')}
        error={errors.type}
        options={[{ value: 'A', label: 'Option A' }, { value: 'B', label: 'Option B' }]}
      />
      <DateField
        label="Start Date"
        registration={register('startDate')}
        error={errors.startDate}
        required
      />
      <Button type="submit">Save</Button>
    </form>
  );
}
```

---

## Adding New Fields

1. Extend the `BaseFieldProps` interface in the new component
2. Add extra props specific to the field type
3. Follow the same label/input/error layout
4. Use the same focus/error styling tokens
5. Document the new field in this contract
6. Add to the barrel export in `src/components/crud/fields/index.ts`
