import { readdirSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import type { PhaseDef, PhaseResult, LoopState, LoopResult, LoopConfig } from './types.js';

export interface Plugin {
  name: string;
  onPhaseStart?: (phase: PhaseDef, state: LoopState) => Promise<void> | void;
  onPhaseEnd?: (phase: PhaseDef, result: PhaseResult, state: LoopState) => Promise<void> | void;
  onError?: (error: Error, phase: PhaseDef) => Promise<void> | void;
  beforeLoop?: (planPath: string) => PhaseDef[] | Promise<PhaseDef[]>;
  afterLoop?: (result: LoopResult) => void | Promise<void>;
}

export interface HookContext {
  phase: PhaseDef;
  result?: PhaseResult;
  state: LoopState;
  error?: Error;
}

/**
 * Load plugins from the configured plugin paths.
 * If config.plugins is provided, use those paths.
 * Otherwise, scan the `plugins/` directory for .ts files.
 * Dynamic-import each plugin module and extract hook functions.
 */
export async function loadPlugins(config: LoopConfig): Promise<Plugin[]> {
  const paths = config.plugins;

  if (paths && paths.length > 0) {
    const plugins: Plugin[] = [];
    for (const p of paths) {
      const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
      const mod = await safeImport(abs);
      if (mod) {
        plugins.push(pluginFromModule(mod, basename(p)));
      }
    }
    return plugins;
  }

  const pluginsDir = join(process.cwd(), 'plugins');
  let files: string[];
  try {
    files = readdirSync(pluginsDir).filter((f) => f.endsWith('.ts'));
  } catch {
    return [];
  }

  const plugins: Plugin[] = [];
  for (const file of files) {
    const abs = join(pluginsDir, file);
    const mod = await safeImport(abs);
    if (mod) {
      plugins.push(pluginFromModule(mod, file.replace(/\.ts$/, '')));
    }
  }
  return plugins;
}

/**
 * Execute all plugin hooks for a given lifecycle event.
 * Never lets a plugin crash the loop — all errors caught and logged.
 */
export async function executeHooks(
  hook: 'onPhaseStart' | 'onPhaseEnd' | 'onError',
  context: HookContext,
  plugins: Plugin[],
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  for (const plugin of plugins) {
    const fn = plugin[hook];
    if (!fn) continue;

    try {
      let args: any[];
      if (hook === 'onPhaseStart') {
        args = [context.phase, context.state];
      } else if (hook === 'onPhaseEnd') {
        args = [context.phase, context.result, context.state];
      } else {
        args = [context.error, context.phase];
      }
      const result = await (fn as (...a: any[]) => Promise<any>)(...args);
      results[plugin.name] = result ?? null;
    } catch (e) {
      console.error(`[plugins] ${plugin.name}.${hook} failed:`, e);
      results[plugin.name] = null;
    }
  }

  return results;
}

// ── Helpers ──

function basename(p: string): string {
  const name = p.replace(/\\/g, '/').split('/').pop() || p;
  return name.replace(/\.ts$/, '');
}

function pluginFromModule(mod: Record<string, unknown>, name: string): Plugin {
  const plugin: Plugin = { name };
  if (typeof mod.onPhaseStart === 'function') plugin.onPhaseStart = mod.onPhaseStart as Plugin['onPhaseStart'];
  if (typeof mod.onPhaseEnd === 'function') plugin.onPhaseEnd = mod.onPhaseEnd as Plugin['onPhaseEnd'];
  if (typeof mod.onError === 'function') plugin.onError = mod.onError as Plugin['onError'];
  if (typeof mod.beforeLoop === 'function') plugin.beforeLoop = mod.beforeLoop as Plugin['beforeLoop'];
  if (typeof mod.afterLoop === 'function') plugin.afterLoop = mod.afterLoop as Plugin['afterLoop'];
  return plugin;
}

/**
 * Execute a plugin's beforeLoop hook.
 * Returns PhaseDef[] from the hook, or empty [] if no hook or on error.
 */
export async function executeBeforeLoop(plugin: Plugin, planPath: string): Promise<PhaseDef[]> {
  if (!plugin.beforeLoop) return [];
  try {
    return await plugin.beforeLoop(planPath);
  } catch (e) {
    console.error(`[plugins] ${plugin.name}.beforeLoop failed:`, e);
    return [];
  }
}

/**
 * Execute a plugin's afterLoop hook.
 * Silently no-ops if no hook defined; catches errors.
 */
export async function executeAfterLoop(plugin: Plugin, result: LoopResult): Promise<void> {
  if (!plugin.afterLoop) return;
  try {
    await plugin.afterLoop(result);
  } catch (e) {
    console.error(`[plugins] ${plugin.name}.afterLoop failed:`, e);
  }
}

async function safeImport(specifier: string): Promise<Record<string, unknown> | null> {
  try {
    return (await import(specifier)) as Record<string, unknown>;
  } catch (e) {
    console.error(`[plugins] Failed to load ${specifier}:`, e);
    return null;
  }
}
