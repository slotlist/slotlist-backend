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
    const sequelize = require('../dist/src/shared/util/sequelize').default;
    const migrateUp = require('../dist/src/shared/util/umzug').migrateUp;
    migrateUp().then(() => {
        sequelize.close();
        cb();
    }).catch((err) => {
        gulpUtil.log(gulpUtil.colors.red('Failed to migrate database up to latest state'));
        gulpUtil.log(gulpUtil.colors.red(err));
        sequelize.close();
        cb(err);
    });
}));

gulp.task('db:migrate:up', __('Migrate database ONE STEP UP from its current state', function (cb) {
    const sequelize = require('../dist/src/shared/util/sequelize').default;
    const migrateUp = require('../dist/src/shared/util/umzug').migrateUp;
    migrateUp(false).then(() => {
        sequelize.close();
        cb();
    }).catch((err) => {
        gulpUtil.log(gulpUtil.colors.red('Failed to migrate database ONE STEP UP from its current state'));
        gulpUtil.log(gulpUtil.colors.red(err));
        sequelize.close();
        cb(err);
    });
}));

gulp.task('db:migrate:down', __('Migrate database ONE STEP DOWN from its current state', function (cb) {
    const sequelize = require('../dist/src/shared/util/sequelize').default;
    const migrateDown = require('../dist/src/shared/util/umzug').migrateDown;
    migrateDown().then(() => {
        sequelize.close();
        cb();
    }).catch((err) => {
        gulpUtil.log(gulpUtil.colors.red('Failed to migrate database ONE STEP DOWN from its current state'));
        gulpUtil.log(gulpUtil.colors.red(err));
        sequelize.close();
        cb(err);
    });
}));