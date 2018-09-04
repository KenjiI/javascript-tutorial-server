/**
 * NB: All tasks are initialized lazily, even plugins are required lazily,
 * running 1 task does not require all tasks' files
 */

const gulp = require('gulp');
const glob = require('glob');
const path = require('path');
const fs = require('fs');
const {lazyRequireTask, requireModuleTasks} = require('jsengine/gulp/requireModuleTasks');
const runSequence = require('run-sequence');

const config = require('config');

process.on('uncaughtException', function(err) {
  console.error(err.message, err.stack, err.errors);
  process.exit(255);
});


gulp.task("nodemon", lazyRequireTask('./tasks/nodemon', {
  // shared client/server code has require('template.jade) which precompiles template on run
  // so I have to restart server to pickup the template change
  ext:    "js,yml",

  nodeArgs: process.env.NODE_DEBUG  ? ['--debug'] : [],
  script: "./bin/server.js",
  //ignoreRoot: ['.git', 'node_modules'].concat(glob.sync('{handlers,modules}/**/client')), // ignore handlers' client code
  ignore: ['**/client/'], // ignore handlers' client code
  watch:  ["modules"]
}));

gulp.task("client:livereload", lazyRequireTask("./tasks/livereload", {
  // watch files *.*, not directories, no need to reload for new/removed files,
  // we're only interested in changes

  watch: [
    "public/pack/**/*.*",
    // this file changes every time we update styles
    // don't watch it, so that the page won't reload fully on style change
    "!public/pack/head.js"
  ]
}));

requireModuleTasks('jsengine/koa/tutorial');

let testSrcs = ['modules/**/test/**/*.js'];
// on Travis, keys are required for E2E Selenium tests
// for PRs there are no keys, so we disable E2E
if (!process.env.TEST_E2E || process.env.CI && process.env.TRAVIS_SECURE_ENV_VARS=="false") {
  testSrcs.push('!modules/**/test/e2e/*.js');
}

gulp.task("test", lazyRequireTask('./tasks/test', {
  src: testSrcs,
  reporter: 'spec',
  timeout: 100000 // big timeout for webdriver e2e tests
}));


gulp.task('watch', lazyRequireTask('./tasks/watch', {
  root:        __dirname,
  // for performance, watch only these dirs under root
  dirs: ['assets', 'styles'],
  taskMapping: [
    {
      watch: 'assets/**',
      task:  'client:sync-resources'
    }
  ]
}));

gulp.task('deploy', function(callback) {
  runSequence("deploy:build", "deploy:update", callback);
});

gulp.task("client:sync-resources", lazyRequireTask('./tasks/syncResources', {
  assets: 'public'
}));


gulp.task('client:minify', lazyRequireTask('./tasks/minify'));
gulp.task('client:resize-retina-images', lazyRequireTask('./tasks/resizeRetinaImages'));

gulp.task('client:webpack', lazyRequireTask('./tasks/webpack'));
// gulp.task('client:webpack-dev-server', lazyRequireTask('./tasks/webpackDevServer'));


gulp.task('build', function(callback) {
  runSequence("client:sync-resources", 'client:webpack', callback);
});

gulp.task('server', lazyRequireTask('./tasks/server'));

gulp.task('edit', ['client:webpack', 'jsengine:koa:tutorial:importWatch', "client:sync-resources", 'client:livereload', 'server']);


gulp.task('dev', function(callback) {
  runSequence("client:sync-resources", ['nodemon', 'client:livereload', 'client:webpack', 'watch'], callback);
});

gulp.on('err', function(gulpErr) {
  if (gulpErr.err) {
    // cause
    console.error("Gulp error details", [gulpErr.err.message, gulpErr.err.stack, gulpErr.err.errors].filter(Boolean));
  }
});

