import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function FormSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <p className="mt-1 text-sm text-app-muted">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-app-text">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 text-app-muted">{hint}</span>}
    </label>
  );
}
