const gulp = require('gulp');
const { src, dest, watch, series, parallel } = gulp;
const csso = require('gulp-csso');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const plumber = require('gulp-plumber');
const cp = require('child_process');
const gulpImagemin = require('gulp-imagemin');
const imagemin = gulpImagemin.default || gulpImagemin;
const browserSync = require('browser-sync').create();

let sassImplementation;
try {
  sassImplementation = require('sass');
} catch (sassError) {
  try {
    sassImplementation = require('node-sass');
  } catch (nodeSassError) {
    console.error('Sass implementation not found. Install `sass` or `node-sass`.');
    process.exit(1);
  }
}
const sassCompiler = require('gulp-sass')(sassImplementation);

const isWindows = /^win/.test(process.platform);
const jekyllCommand = isWindows ? 'jekyll.bat' : 'bundle';
const jekyllArgs = isWindows ? ['build'] : ['exec', 'jekyll', 'build'];

const paths = {
  styles: 'src/styles/**/*.scss',
  fonts: 'src/fonts/**/*.{ttf,woff,woff2}',
  scripts: 'src/js/**/*.js',
  images: 'src/img/**/*.{jpg,png,gif}'
};

function jekyllBuild(done) {
  const jekyll = cp.spawn(jekyllCommand, jekyllArgs, { stdio: 'inherit' });

  jekyll.on('close', (code) => {
    if (code !== 0) {
      done(new Error(`Jekyll process exited with code ${code}`));
      return;
    }
    done();
  });
}

function reload(done) {
  browserSync.reload();
  done();
}

function sassTask() {
  return src(paths.styles)
    .pipe(plumber())
    .pipe(sassCompiler())
    .pipe(csso())
    .pipe(dest('assets/css/'))
    .pipe(browserSync.stream());
}

function fontsTask() {
  return src(paths.fonts)
    .pipe(plumber())
    .pipe(dest('assets/fonts/'))
    .pipe(browserSync.stream());
}

function imagesTask() {
  return src(paths.images)
    .pipe(plumber())
    .pipe(imagemin({ optimizationLevel: 3, progressive: true, interlaced: true }))
    .pipe(dest('assets/img/'))
    .pipe(browserSync.stream());
}

function jsTask() {
  return src(paths.scripts)
    .pipe(plumber())
    .pipe(concat('main.js'))
    .pipe(uglify())
    .pipe(dest('assets/js/'))
    .pipe(browserSync.stream());
}

function serve(done) {
  browserSync.init({
    server: {
      baseDir: '_site'
    }
  });
  done();
}

function watchFiles() {
  watch(paths.styles, series(sassTask, jekyllBuild, reload));
  watch(paths.fonts, series(fontsTask, jekyllBuild, reload));
  watch(paths.scripts, series(jsTask, jekyllBuild, reload));
  watch(paths.images, series(imagesTask, jekyllBuild, reload));
  watch(['*.html', '_layouts/*.html', '_includes/*.html'], series(jekyllBuild, reload));
}

const build = series(parallel(jsTask, sassTask, fontsTask, imagesTask), jekyllBuild);

exports.build = build;
exports.sass = sassTask;
exports.fonts = fontsTask;
exports.js = jsTask;
exports.images = imagesTask;
exports.jekyll = jekyllBuild;
exports.default = series(build, serve, watchFiles);
