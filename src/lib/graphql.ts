import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

export async function ghGraphQL(query: string, variables?: Record<string, any>) {
  // Use -f query="..." to pass the main GraphQL query
  const args: string[] = ['api', 'graphql', '-f', `query=${query}`];
  
  if (variables) {
    for (const k of Object.keys(variables)) {
      const raw = (variables as any)[k];
      let value = String(raw);

      if (typeof raw === 'number' || typeof raw === 'boolean') {
        value = String(raw);
      } else if (typeof raw === 'string') {
        value = raw;
      }
      
      args.push('-F', `${k}=${value}`);
    }
  }

  try {
    const { stdout } = await execFileP('gh', args, { maxBuffer: 10 * 1024 * 1024 });
    try {
      return JSON.parse(stdout);
    } catch (err) {
      throw new Error('gh returned non-JSON: ' + String(stdout).slice(0, 2000));
    }
  } catch (err: any) {
    const message = err?.stderr || err?.message || String(err);
    throw new Error('gh api graphql failed: ' + message);
  }
}
