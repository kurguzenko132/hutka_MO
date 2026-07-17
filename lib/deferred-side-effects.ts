import 'server-only';
import { after } from 'next/server';

type DeferredEffect = () => Promise<unknown>;

export function deferSideEffects(...effects: DeferredEffect[]) {
  after(async () => {
    const results = await Promise.allSettled(effects.map((effect) => effect()));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      console.error(`Deferred side effects failed: ${failed}/${effects.length}`);
    }
  });
}
