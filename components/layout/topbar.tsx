import { Bell, Menu, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from './logo';

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-app-line bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-8">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <button className="rounded-xl border border-app-line p-2 text-app-muted lg:hidden" aria-label="Открыть меню">
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
          <Input className="pl-10" placeholder="Поиск по контактам, компаниям, тегам..." />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-app-line bg-slate-50 px-2 py-0.5 text-xs text-app-faint">⌘ K</span>
        </div>
        <button className="relative rounded-xl border border-app-line p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple" aria-label="Уведомления">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-app-red text-[10px] font-bold text-white">5</span>
        </button>
        <Button className="hidden sm:inline-flex">
          <Plus className="h-4 w-4" />
          Добавить контакт
        </Button>
      </div>
    </header>
  );
}
