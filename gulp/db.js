/* Required polyfills setup (see src/polyfills.ts) */
const cls = require('continuation-local-storage');
const uuid = require('uuid');
const processCLSNamespace = cls.createNamespace(`SL_${uuid.v4()}`);
const Sequelize = require('sequelize');
Sequelize.useCLS(processCLSNamespace);
const bluebird = require('bluebird');
const patchBluebird = require('cls-bluebird');
patchBluebird(processCLSNamespace);
global.Promise = bluebird;
console.info(`Polyfills installed. CLS=${processCLSNamespace.name}`);
/* End of required polyfills setup */

const gulp = require('gulp');
const gulpUtil = require('gulp-util');
const __ = require('./__');

gulp.task('db:migrate', __('Migrate database up to latest state', function (cb) {
    const storage = require('../dist/src/shared/services/Storage').default;
    storage.migrateUp().then(() => {
        storage.disconnect();
        cb();
    }).catch((err) => {
        storage.disconnect();
        cb(err);
    });
}));

gulp.task('db:migrate:up', __('Migrate database ONE STEP UP from its current state', function () {
    const storage = require('../dist/src/shared/services/Storage').default;
    return storage.migrateUp(false);
}));

gulp.task('db:migrate:down', __('Migrate database ONE STEP DOWN from its current state', function () {
    const storage = require('../dist/src/shared/services/Storage').default;
    return storage.migrateDown();
}));