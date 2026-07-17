import type { createClient } from '@/lib/supabase/server';
import { databaseTables, type DatabaseTable } from '@/lib/database-tables';

export type DatabaseTableCount = {
  table: DatabaseTable;
  count: number;
  error?: string;
};

export async function getDatabaseTableCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  concurrency = 8
): Promise<DatabaseTableCount[]> {
  const results = new Array<DatabaseTableCount>(databaseTables.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < databaseTables.length) {
      const index = nextIndex;
      nextIndex += 1;
      const table = databaseTables[index];
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      results[index] = {
        table,
        count: count ?? 0,
        error: error?.message
      };
    }
  }

  const workerCount = Math.min(Math.max(Math.floor(concurrency) || 1, 1), databaseTables.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
