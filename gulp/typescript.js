const gulp = require('gulp');
const gulpUtil = require('gulp-util');
const gulpTypescript = require('gulp-typescript');
const gulpTslint = require('gulp-tslint');
const gulpSourceMaps = require('gulp-sourcemaps');
const __ = require('./__');
const typescript = require('typescript');
const tslint = require('tslint');

const tsProject = gulpTypescript.createProject('tsconfig.json', {
    typescript: typescript
});

const tsProgram = tslint.Linter.createProgram('tsconfig.json');

gulp.task('tslint', __('Lints all TypeScript files using tslint', function () {
    return gulp.src(['src/**/*.ts'])
        .pipe(gulpTslint({
            tslint: tslint,
            formatter: 'verbose',
            configuration: 'tslint.json',
            program: tsProgram
        }))
        .pipe(gulpTslint.report({
            emitError: false
        }));
}));

gulp.task('typescript', __('Compile all TypeScript files using tsc', function () {
    const tsResult = gulp.src(['src/**/*.ts'])
        .pipe(gulpUtil.log(gulpUtil.colors.yellow(`Using TypeScript compiler v${typescript.version}`)).noop())
        .pipe(gulpSourceMaps.init())
        .pipe(tsProject());

    return tsResult.js
        .pipe(gulpSourceMaps.write('./'))
        .pipe(gulp.dest('dist/src'));
}));