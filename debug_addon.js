import * as addon from 'dexie-cloud-addon';
import defaultAddon from 'dexie-cloud-addon';

console.log('--- EXPORTS ---');
console.log('Keys:', Object.keys(addon));
console.log('Default export:', typeof defaultAddon);
console.log('Is default same as namespace?', addon.default === defaultAddon);
if (typeof defaultAddon === 'function') {
    console.log('Default is generic function');
} else if (typeof defaultAddon === 'object') {
    console.log('Default keys:', Object.keys(defaultAddon || {}));
}
console.log('--- END ---');
