const gulp = require('gulp');
const gulpUtil = require('gulp-util');
const __ = require('./__');
const runSequence = require('run-sequence');

gulp.task('default', __('Default task, builds TypeScript and watches for file changes', function (callback) {
    runSequence(['build'], ['watch'], callback);
}));

gulp.task('build', __('Default build task, builds all TypeScript source files into dist/src', function (callback) {
    runSequence(['tslint'], ['typescript'], callback);
}));

gulp.task('watch', __('Watches for file system changes and triggers rebuilds', function () {
    gulpUtil.log(gulpUtil.colors.yellow('Pretending to react to fs changes \o/'));
}));