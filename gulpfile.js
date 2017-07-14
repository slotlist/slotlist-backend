const start = new Date();

console.info('Initializing gulp tasks...');

require('require-dir')('./gulp', {
    recurse: true
});

const stop = new Date();
const diff = (start.getTime() - stop.getTime()) / 1000;
console.info(`Gulp tasks initialized in ${diff} seconds`);