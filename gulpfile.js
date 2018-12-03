var gulp = require('gulp'),
    browserSync = require('browser-sync'),
    sass = require('gulp-sass'),
    path = require('path'),
    cp = require('child_process'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    gutil = require('gulp-util'),
    plumber = require('gulp-plumber'),
    runSequence = require('run-sequence'),
    rename = require("gulp-rename"),
    inlineCss = require('gulp-inline-css'),
    zip = require('gulp-zip'),
    gulpCopy = require('gulp-copy'),
    clean = require('gulp-clean'),
    mail = require('gulp-mail'),
    prompt = require('gulp-prompt'),
    sftp = require('gulp-sftp'),
    csso = require('gulp-csso'),
    fs = require('fs'),
    removeEmptyLines = require('gulp-remove-empty-lines'),
    replace = require('gulp-url-replace'),
    deleteUnusedImages = require('gulp-delete-unused-images'),
    unusedImages = require('gulp-unused-images');

var pathsJson = JSON.parse(fs.readFileSync('./paths.json'));
var folderName = pathsJson.folderPath || 'folder_name';
var projectName = pathsJson.projectPath || 'project_name';

var paths = {
    filesPath: ['./_site/' + projectName + '/' + folderName + '/*.html'],
    outputPath: './mail/' + folderName,
    imgPath:'./assets/img/' + projectName + '/*'
};

var ftp = {
    host: '',
    user: '',
    pass: '',
    port: 21
};

var ftpPath = 'emails/';

//var imgServerPath ='http://' + ftp.host + ftpPath;
//var ftpPath = '' + folderName;
var imgServerPath ='';

//var localPath = '' + projectName + '/';
var localPath = '/assets/img/' + projectName + '/';

var smtpData = {
    auth: {
        user: '',
        pass: ''
    },

    host: '',
    port: 25
};

var emails =  [
    'myemail@yandex.ua',
    'myemail@gmail.com',
    'myemail@mail.ru'
];

var messages = {
    jekyllBuild: '<span style="color: grey;opacity:0.3;">Running:</span> $ jekyll build'
};

/* Set folder and project name's */
gulp.task('prompt', function () {
    return gulp.src('./')
        .pipe(prompt.prompt([{
                type: 'input',
                name: 'folderName',
                message: 'Folder Name?'
            },
                {
                    type: 'input',
                    name: 'projectName',
                    message: 'Project Name?'
                }],

            function(res){
                fs.writeFile('./paths.json', '{ "folderPath" : "' + res.folderName + '", "projectPath" : "' + res.projectName + '" }');
            }));
});

/* Build the Jekyll Site */
gulp.task('jekyll-build', function (done) {
    browserSync.notify(messages.jekyllBuild);
    var jekyll = process.platform === "win32" ? "jekyll.bat" : "jekyll";
    return cp.spawn(jekyll, ['build'], {stdio: 'inherit'})
        .on('close', done);
});

/* Rebuild Jekyll & do page reload */
gulp.task('jekyll-rebuild', ['jekyll-build'], function () {
    return browserSync.reload();
});

/* Wait for jekyll-build, then launch the Server */
gulp.task('browser-sync', ['sass', 'jekyll-build'], function() {
    browserSync({
        server: {
            baseDir: '_site'
        }
    });
});

/* Compile files from _scss into both _site/css (for live injecting) and site (for future jekyll builds) */
gulp.task('sass', function () {
    return gulp.src('_scss/*.scss')
        .pipe(plumber(function(error) {
            gutil.log(gutil.colors.red(error.message));
            this.emit('end');
        }))
        .pipe(sass({
            includePaths: ['scss'],
            outputStyle: 'expanded',
            onError: browserSync.notify
        }))
        .pipe(gulp.dest('_site/assets/css'))
        .pipe(csso())
        .pipe(browserSync.reload({stream:true}))
        .pipe(gulp.dest('assets/css'));
});

/* InlineCss */
gulp.task('inlineCss', function () {
    return gulp.src(paths.filesPath)
        .pipe(inlineCss({
            applyStyleTags: true,
            applyLinkTags: true,
            removeStyleTags: true,
            removeLinkTags: true,
            removeHtmlSelectors: true
        }))
        .pipe(gulp.dest(paths.outputPath));
});

/* Reformat output html */
gulp.task('reformat', function () {
    return gulp.src(paths.outputPath + '/*.html')
        .pipe(removeEmptyLines({
            removeComments: true
        }))
        .pipe(gulp.dest(paths.outputPath));
});

/* Copy project img's to folder */
gulp.task('copy', function () {
    return gulp
        .src(paths.imgPath)
        .pipe(gulp.dest(paths.outputPath +'/images'));
});

/* For Windows show unused img */
gulp.task('filter', function () {
    return gulp.src([paths.outputPath +'/images/*',  paths.outputPath + '/*.html'])
        .pipe(plumber())
        .pipe(unusedImages({delete: true, log: true }))
        .pipe(plumber.stop());
});

/* Delete unused image */
gulp.task('prepare', function() {
    return gulp.src([paths.outputPath +'/images/*', paths.outputPath + '/*.html'])
        .pipe(plumber())
        .pipe(deleteUnusedImages({
            log: false,
            delete: true
        }));
});

/* Set time out to FTP */
gulp.task('sync', function (cb) {
    setTimeout(function () {
        cb();
    }, 500);
});

/* SFPT upload project img's to server */
gulp.task('ftp', function () {
    return gulp.src(paths.outputPath +'/images/*')
        .pipe(sftp({
            host: ftp.host,
            user: ftp.user,
            pass: ftp.pass,
            port: ftp.port,
            remotePath: ftpPath
        }));
});

/* Rewrite paths */
gulp.task('replacePaths', function(){
    var replObj = {};
    replObj[localPath] = imgServerPath;
    return gulp.src(paths.outputPath + '/*.html')
        .pipe(replace(replObj))
        .pipe(gulp.dest(paths.outputPath))
});

/* Send Email */
gulp.task('send', function() {
    return gulp.src(paths.outputPath + '/*.html')
        .pipe(mail({
            subject: 'Surprise!?',
            to: emails,
            from: '',
            smtp: smtpData
        }))
        .on('end', function() {
            process.exit();
        })
});

/* Zip folder */
gulp.task('zip', function () {
    return gulp.src(paths.outputPath + '/**')
        .pipe(zip(paths.outputPath + '.zip'))
        .pipe(gulp.dest('./'));
});

/* Delete folder mail */
gulp.task('clean', function () {
    return gulp.src(('mail'), {read: false})
        .pipe(clean());
});

/* Watch scss files for changes & recompile, watch html/md files, run jekyll & reload BrowserSync */
gulp.task('watch', ['browser-sync'], function () {
    gulp.watch([
        '_scss/**/*.scss',
        '_components/**/*.scss'
    ], ['sass']);
    gulp.watch([
        '_layouts/*.html',
        '_components/**/*.html',
        '_components/**/*.yml',
        '_pages/**/*',
        '_posts/**/*',
        'assets/img/**/*',
        '_config.yml'
    ], ['jekyll-rebuild']);
});

/* Default task, running just `gulp` will compile the sass, compile the jekyll site, launch BrowserSync & watch files. */
gulp.task('default', ['sass', 'jekyll-build']);

/*Copy project images, generate html with inline css, delete unused images, upload by FTP */
//gulp.task('img', function(cb) {
//    runSequence('copy', ['inlineCss'], ['prepare'], ['sync'], 'ftp', cb);
//});

/*Generate html with inline css, replace local paths in src images to remote server paths, reformat html, send by SMTP */
//gulp.task('email', function(cb) {
//    runSequence('inlineCss', ['replacePaths'] , ['reformat'], 'send', cb);
//});

//Trial for whiout FTP connection

gulp.task('img', function(cb) {
    runSequence('copy', ['inlineCss'], ['prepare'], ['sync'], cb);
});

gulp.task('email', function(cb) {
    runSequence('inlineCss', ['replacePaths'] , ['reformat'], cb);
});

gulp.task('windows', function(cb) {
    runSequence('copy','inlineCss', ['replacePaths'] , ['reformat'], 'send', cb);
});