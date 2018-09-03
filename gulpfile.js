const gulp = require('gulp');
const tinypng = require('gulp-tinypng-compress');
const filter = require('gulp-filter');
const clean = require('gulp-clean');
const fs = require('fs');
const path = require('path');

gulp.task('build:clean', () =>
	// select all the images inside the assets folder and all the files at the first directory level
	gulp.src(['./dist/assets/*.+(png|jpg)', './dist/*.*'])
		// filter out all the files that are present with the same name inside the source asset folder
		.pipe(filter(function(file) {
			return !fs.existsSync(path.resolve(__dirname + `/src/assets/${file.basename}`))
		}))
		// delete the remaining files
		.pipe(clean())
);

gulp.task('build:js', () =>
	gulp.src('./src/index.js')
		.pipe(gulp.dest('./dist/'))
);

gulp.task('build:html', () => 
	gulp.src('./src/**/*.html')
		.pipe(gulp.dest('./dist/'))
);

gulp.task('build:images', () =>
	gulp.src('./src/**/*.+(png|jpg)')
		.pipe(tinypng({
			key: require('./tinypng-api.json').key,
			sigFile: './tinypng-api.json',
			log: true
		}))
		.pipe(gulp.dest('./dist/'))
);

gulp.task('build', gulp.series('build:clean', gulp.parallel('build:html', 'build:js', 'build:images')));

gulp.task('build:watch', () =>
	gulp.watch('./src/**/*', gulp.series('build'))
);