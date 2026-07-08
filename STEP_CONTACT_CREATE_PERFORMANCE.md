# Contact create performance fix

This patch targets the heavy UI/CPU load that happened while adding a contact.

## What changed

- `/people/new` no longer loads full settings, users and usage counters.
- Added lightweight `getLeadFormOptions()` for the create/edit contact form directories.
- Limited directory queries for sources, stages and tags.
- Deduplicated and normalized source names before rendering form options.
- Removed heavy gradient/shadow styling from the helper card on the contact create page.
- Reduced recommended tag chips on the create page.
- Removed transitions from form inputs/selects/textareas and reduced focus ring size.
- Narrowed cache revalidation after contact creation to avoid unnecessary dashboard invalidation.

## Files

- `lib/lead-form-options.ts`
- `app/(dashboard)/people/new/page.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/textarea.tsx`
- `actions/leads.actions.ts`
- `package.json`

## Check

Run:

```bash
pnpm install
pnpm build
```

Then test:

- `/people/new`
- create contact
- type in fields for 30–60 seconds
- submit contact
- open created contact page

The page should feel lighter and should not trigger the same device heating during contact creation.
