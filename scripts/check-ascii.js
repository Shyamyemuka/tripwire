const fs = require('fs');
const path = require('path');

let found = 0;
function check(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      check(full);
    } else if (/\.(ts|tsx)$/.test(item.name)) {
      const buf = fs.readFileSync(full);
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] > 127) {
          console.log('Non-ascii byte', buf[i].toString(16), 'in', full, 'at', i);
          found++;
          break;
        }
      }
    }
  }
}
check('src');
console.log('Total non-ascii files:', found);