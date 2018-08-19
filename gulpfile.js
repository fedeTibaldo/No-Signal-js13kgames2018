const gulp = require('gulp');
const compiler = require('webpack');
const webpack = require('webpack-stream');
const rimraf = require('rimraf');

/*********** DEV TASKS ***********/
// no minification, no transpile
// yes watching

gulp.task('dev:clear', function(done) {
	rimraf('./dev/', done);
});

gulp.task('dev:js', () =>
	gulp.src('./src/index.js')
		.pipe(webpack( require('./webpack.config.js') ), compiler)
		.pipe(gulp.dest('./dev/'))
);

gulp.task('dev:move', () => 
	gulp.src('./src/**/*.+(svg|png|jpg)')
		.pipe(gulp.dest('./dev/'))
);

gulp.task('dev', gulp.series('dev:clear', gulp.parallel('dev:move', 'dev:js')));

gulp.task('dev:watch', () =>
	gulp.watch('./src/**/*', gulp.series('dev'))
);

/******* end  of dev tasks *******/