/**
 * Generate a fresh 32-byte MEK and print it as base64.
 * Usage: pnpm --filter @akw/scripts gen:mek
 */

const bytes = new Uint8Array(32);
crypto.getRandomValues(bytes);
let bin = '';
for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
const b64 = btoa(bin);
console.log('Add this to your .env / Workers secret as MEK:\n');
console.log(b64);
console.log('\nIMPORTANT: Once you start storing keys, rotating MEK requires a re-wrap migration.');
