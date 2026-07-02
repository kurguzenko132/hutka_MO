import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app-bg">
      <Sidebar />
      <div className="lg:pl-72">
        <Topbar />
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
