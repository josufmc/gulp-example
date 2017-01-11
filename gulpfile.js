// Gulp.js configuration

// include gulp and plugins
var
	gulp = require('gulp'),
	newer = require('gulp-newer'),
	concat = require('gulp-concat'),		// Concatenar archivos
	deporder = require('gulp-deporder'),	// Cargar dependencias en orden (Primero jQuery, etc...)
	preprocess = require('gulp-preprocess'),
	urlAdjuster = require('gulp-css-url-adjuster'),		// Para ajustar la ruta de las imágenes css
	sass = require('gulp-sass'),
	pleeease = require('gulp-pleeease'),
	jshint = require('gulp-jshint'),		// Procesado de JS. Nos advierte de errores, etc...
	stripdebug = require('gulp-strip-debug'),		// Eliminar espacios en blanco
	uglify = require('gulp-uglify'),				// Comprimir nombres de variables
	htmlclean = require('gulp-htmlclean'),
	imagemin = require('gulp-imagemin'),
	imacss = require('gulp-imacss'),
	size = require('gulp-size'),
	del = require('del'),
	pkg = require('./package.json')
	browsersync = require('browser-sync')
	;

// file locations
var
	devBuild = ((process.env.NODE_ENV || 'development').trim().toLowerCase() !== 'production'),	// Evaulamos variable de entorno

	source = 'source/',
	dest = 'build/',
	
	html = {
		in: source + '*.html',
		watch: [source + '*.html', source + 'template/**/*'],
		out: dest,
		// Se usa para las variables html (versión, autor, etc...)
		context: {
			devBuild: devBuild,
			author: pkg.author,
			version: pkg.version
		}
	},

	images = {
		in: source + 'images/*.*',
		out: dest + 'images/'
	},
	
	// Convertir imágenes a base64
	imguri = {
		in: source + 'images/inline/*',
		out: dest + 'scss/images/',
		filename: '_datauri.scss',
		namespace: 'img'
	},
	
	css = {
		in: source + 'scss/main.scss',
		watch: [source + 'scss/**/*', '!' + imguri.out + imguri.filename],
		out: dest + 'css/',
		// Opciones de sass
		sassOpts: {
			outputStyle: 'nested',
			imagePath: '../images/',	// Resuelve las imágenes
			precision: 3,			// Precisión de cálculos
			errLogToConsole: true
		},
		pleeeaseOpts:{
			autoprefixer: {browsers: ['last 2 versions']},	// Compatibilidades
			rem: ['16px'],
			pseudoElements: true,	// Relacionado con comillas simples y dobles
			mqpacker: true,			// Mete varias media queries en una
			minifier: !devBuild
			
		}
	},
	
	fonts = {
		in: source + 'fonts/*.*',
		out: css.out + 'fonts/'
	},
	
	js = {
		in: source + 'js/**/*',
		out: dest + 'js/',
		filename: 'main.js'
	},
	
	syncOpts = {
		server: {
			baseDir: dest,
			index: 'index.html'
		},
		open: false, 	// Abrir el navegador por defecto
		notify:true		// Notifica cuando hace algo
		
	}
	;

// show build type
console.log(pkg.name + ' ' + pkg.version + ', ' + (devBuild ? 'development' : 'production') + ' build');


// clean build folder
gulp.task('clean', function(){
	del([dest + '*']);
});

// Build HTML files
gulp.task('html', function(){
	var page = gulp.src(html.in).pipe(preprocess({context: html.context}));	// Preprocesamos con las variables
	// Si estamos en producción, hacemos el minimificado
	if (!devBuild){
		page = page
			.pipe(size({title: 'HTML in'}))		// Medimos el tamaño de entrada
			.pipe(htmlclean())
			.pipe(size({title: 'HTML out'}))	// Medimos el tamaño de salida
			;
	}
	return page.pipe(gulp.dest(html.out));
});
	
// manage images
gulp.task('images', function() {
	return gulp.src(images.in)
		.pipe(newer(images.out))	// Comprueba imágenes nuevas
		.pipe(imagemin())
		.pipe(gulp.dest(images.out));
});

gulp.task('fonts', function(){
	return gulp.src(fonts.in)
		.pipe(newer(fonts.out))	// Copiamos sólo las nuevas fuentes
		.pipe(gulp.dest(fonts.out));
});

// convert inline images to dataURIs in SCSS source
gulp.task('imguri', function(){
	return gulp.src(imguri.in)
		.pipe(imagemin())
		.pipe(imacss(imguri.filename, imguri.namespace))
		.pipe(gulp.dest(imguri.out));
});

// compile Sass (Añadimos dependencia imguri para que no casque si hay nuevas imágenes)
gulp.task('sass', ['imguri'], function(){
	return gulp.src(css.in)
		.pipe(sass(css.sassOpts))
		.pipe(urlAdjuster({
			prepend: css.sassOpts.imagePath
		}))
		.pipe(size({title: 'CSS in '}))
		.pipe(pleeease(css.pleeeaseOpts))	// Post compilación y minimificado
		.pipe(size({title: 'CSS out '}))
		.pipe(gulp.dest(css.out))
		.pipe(browsersync.reload({stream: true}))	// Recarga
		;
});


gulp.task('js', function(){
	if (devBuild){
		return gulp.src(js.in)
			.pipe(newer(js.out))
			.pipe(jshint())
			.pipe(jshint.reporter('default'))	// Sacamos los errores
			.pipe(jshint.reporter('fail'))
			.pipe(gulp.dest(js.out))
			;
	} else {
		del([dest + 'js/*']);
		return gulp.src(js.in)
			// Deporder requiere en los archivos js que va a cargar (Al principio del todo, sus dependencias). Ejemplo:
			// requires: scrollto.js
			.pipe(deporder())		
			.pipe(concat(js.filename))
			.pipe(size({title: 'JS in'}))
			.pipe(stripdebug())
			.pipe(uglify())
			.pipe(size({title: 'JS out'}))
			.pipe(gulp.dest(js.out))
			;
	}
});

// Browser sync
gulp.task('browsersync', function(){
	browsersync(syncOpts);
})

// default task
gulp.task('default', ['html', 'images', 'fonts', 'sass', 'js', 'browsersync'], function() {
	
	// html changes run task	(Se le da un array de rutas de observación y las tareas a llevar a cabo)
	gulp.watch(html.watch, ['html', browsersync.reload]);
	
	// image changes, run task
	gulp.watch(images.in, ['images']);
	
	// font changes
	gulp.watch(fonts.in, ['fonts']);
	
	// sass changes (Tanto en la carpeta css como en la de los iconos a codificar en base64)
	gulp.watch([css.watch, imguri.in], ['sass']);
	
	// javascript changes
	gulp.watch([js.in], ['js', browsersync.reload]);
});

/*
// Nos ejecuta las tareas del array
gulp.task('default', ['clean', 'images'], function() {...}
*/