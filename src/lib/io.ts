import * as fs from 'fs';

export function writeResult(outfile: string | undefined, result: any) {
  if (outfile) {
    fs.writeFileSync(outfile, JSON.stringify(result, null, 2));
    console.log(`\n✅ Output written to ${outfile}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
