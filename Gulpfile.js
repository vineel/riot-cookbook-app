var gulp = require('gulp');
var watch = require('gulp-watch');
var browserify = require('browserify');
var riotify = require('riotify');
var source = require('vinyl-source-stream');


gulp.task('browserify', function() {
  return browserify({
    debug:true,
    entries: ['./browserify_entrypoint.js'],
    transform: [riotify]
  }).bundle()
  .pipe(source('main.bundle.js'))
  .pipe(gulp.dest('./dist/js'));
});


gulp.task('watch', ['browserify'], function() {
  gulp.watch('index.html', ['browserify']);
  gulp.watch('*.js', ['browserify']);
  gulp.watch('tags/*', ['browserify']);
  gulp.watch('support-tags/*', ['browserify']);
  gulp.watch('pages/*', ['browserify']);
});

gulp.task('default', ['browserify']);