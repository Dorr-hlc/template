const autoprefixer = require("gulp-autoprefixer");
const browserSync = require("browser-sync").create();
const cssnano = require("gulp-cssnano");
const del = require("del");
const eslint = require("gulp-eslint");
const fs = require("fs");
const gulp = require("gulp");
const handlebars = require("gulp-compile-handlebars");
const htmlmin = require("gulp-htmlmin");
const imagemin = require("gulp-imagemin");
const inlinesource = require("gulp-inline-source");
const jshint = require("gulp-jshint");
const layouts = require("handlebars-layouts");
const plumber = require("gulp-plumber");
const less = require("gulp-less");
const lesshint = require("gulp-lesshint");
const { reload } = browserSync;
const rename = require("gulp-rename");
const replace = require("gulp-replace");
const sourcemaps = require("gulp-sourcemaps");
const uglify = require("gulp-uglify");
const yaml = require("js-yaml");
const path = require("path");
const gulpData = require("gulp-data");
const ftp = require("vinyl-ftp");

const dataYml = yaml.safeLoad(fs.readFileSync('./config.yml', "utf-8"));
const htmlFileName = dataYml.htmlFileName;
const ftpConfig = dataYml.ftpConfig;
const rev = require("uuid").v4();
handlebars.Handlebars.registerHelper(layouts(handlebars.Handlebars));
handlebars.Handlebars.registerHelper("reverse", (arr) => {
  arr.reverse();
});
handlebars.Handlebars.registerHelper(
  "ifEquals",
  function (arg1, arg2, options) {
    return arg1 == arg2 ? options.fn(this) : options.inverse(this);
  }
);

function catchErr(e) {
  console.log(e.messageFormatted);
  this.emit("end");
}

gulp.task("reload", (done) => {
  done();
  reload();
});

gulp.task("less:lint", () =>
  gulp
    .src("./src/assets/less/**/*.less") // 监控 less 文件
    .pipe(plumber())
    .pipe(lesshint()) // 使用 gulp-lesshint 进行 lint
    .pipe(lesshint.reporter())
);
gulp.task("less:build", () =>
  gulp
    .src(["./src/assets/less/**/*.less", "!./src/assets/less/**/_*.less"])
    .pipe(rename({ suffix: ".min" }))
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(
      less({
        compress: false, // 不压缩，方便 sourcemaps 生成
      })
    )
    .on("error", catchErr)
    .pipe(
      autoprefixer({
        overrideBrowserslist: ["last 1 version", "> 0.2%"],
      })
    )
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("./dist/assets/css/"))
);


gulp.task("less:optimized", () =>
  gulp
    .src(["./src/assets/less/**/*.less", "!./src/assets/less/**/_*.less"])
    .pipe(rename({ suffix: ".min" }))
    .pipe(plumber())
    .pipe(
      less({
        compress: true, // 开启压缩
      })
    )
    .pipe(autoprefixer())
    .pipe(cssnano({ compatibility: "ie8" }))
    .pipe(gulp.dest("dist/assets/css/"))
);


gulp.task("less", gulp.series("less:lint", "less:build"));


gulp.task("js:build", () =>
  gulp
    .src("src/assets/js/**/*.js")
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("dist/assets/js"))
);

gulp.task("js:lint", () =>
  gulp
    .src(["./src/assets/js/**/*.js", "!./src/assets/js/lib/**/*.js", "gulpfile.js"])
    .pipe(plumber())
    .pipe(eslint())
    .pipe(jshint())
    .pipe(jshint.reporter("default"))
);

gulp.task("js", gulp.series("js:lint", "js:build"));

gulp.task("images", () =>
  gulp
    .src("./src/assets/img/**/*")
    .pipe(plumber())
    .pipe(gulp.dest("./dist/assets/img"))
);

gulp.task("images:optimized", () =>
  gulp
    .src("./src/assets/img/**/*")
    .pipe(plumber())
    .pipe(
      imagemin({
        progressive: true,
        multipass: true,
      })
    )
    .pipe(gulp.dest("./dist/assets/img"))
);




gulp.task("templates", () => {

  return gulp
    .src("./src/templates/**/*.hbs")
    .pipe(plumber())
    .pipe(
      gulpData((file) => {
        // 1. 解析 .hbs 文件路径
        const relativePath = path.relative(
          path.resolve("./src/templates"), // 模板根目录
          file.path
        ); // 例如：ub/de/index.hbs 或 ub/index.hbs
        console.log(`Processing file: ${relativePath}`);

        // 2. 提取路径信息

        const pathParts = relativePath.split(path.sep); // 分割路径
        const website = pathParts[0]; // 获取网站部分：ub
        const lang = pathParts.length === 3 ? pathParts[1] : "en"; // 获取语言部分：de / it
        const urlPath = lang == 'en' ? '' :  lang;
        let ymlFileName = `/${website}/${lang}`; // 默认值
        if (relativePath.includes('am-de')) {
          ymlFileName = `/${website}/de`;
        }
        if (relativePath.includes('am-fr')) {
          ymlFileName = `/${website}/fr`;
        }
        if (relativePath.includes('am-jp')) {
          ymlFileName = `/${website}/jp`;
        }
        // 3. 构建 yml 文件路径
        const ymlFilePath = `./src/yml${ymlFileName}.yml`;
        // 4. 读取并解析 yml 文件
        let templateData = {};
        if (fs.existsSync(ymlFilePath)) {
          try {
            templateData = yaml.safeLoad(fs.readFileSync(ymlFilePath, "utf-8"));
            templateData.language = lang;
            templateData.meta.canonical = dataYml.domain[website] + urlPath + '/landing/' + htmlFileName + '.html';
            templateData.cdn_url = dataYml.cdn_url[website];
            templateData.gtm_code = dataYml.gtm_code[website];
            console.log(`✅ Loaded data from: ${ymlFilePath}`);
          } catch (err) {
            console.error(`❌ Error reading YAML file: ${ymlFilePath}`, err);
          }
        } else {
          console.warn(`⚠️ YAML file not found: ${ymlFilePath}, using empty data.`);
        }

        // 5. 返回数据供 Handlebars 模板使用
        return templateData;
      })
    )
    // 5. 编译 Handlebars 模板
    .pipe(
      handlebars({}, {
        ignorePartials: true,
        batch: ["./src/partials/"],
        helpers: {},
      })
    )
    .pipe(
      rename((path) => {
        path.basename = htmlFileName;
        path.extname = ".html";
      })
    )
    .pipe(gulp.dest("dist"));
});

gulp.task(
  "templates:optimized",
  gulp.series("templates", () =>
    gulp
      .src("./dist/**/*.html")
      .pipe(
        inlinesource({
          rootpath: `${process.cwd()}/dist`,
        })
      )
      .pipe(replace(/@@hash/g, rev))
      .pipe(replace(/\.\.\//g, ""))
      .pipe(
        htmlmin({
          collapseWhitespace: true,
          removeComments: true,
        })
      )
      .pipe(gulp.dest("./dist/"))
  )
);

gulp.task("clean", (done) => del("./dist/", done));

gulp.task("watch", () => {
  gulp.watch(
    [
      "./src/templates/**/*.hbs",
      "./src/partials/**/*.hbs",
      "./src/yml/**/*.yml",
      "events.json",
      "gulpfile.js",
    ],
    gulp.series("templates", "reload")
  );
  gulp.watch(["./src/assets/less/**/*.less"], gulp.series("less", "reload"));
  gulp.watch("./src/assets/img/**/*", gulp.series("images", "reload"));
  gulp.watch(["./src/assets/js/**/*.js", "gulpfile.js"], gulp.series("js", "reload"));
});


gulp.task(
  "build",
  gulp.series(
    "clean",
    gulp.parallel("less", "images", "js", "templates"),
  )
);

gulp.task(
  "build:optimized",
  gulp.series(
    "clean",
    gulp.parallel(
      "less:optimized",
      "images:optimized",
      "js",
      "templates:optimized"
    )
  )
);


gulp.task(
  "serve",
  gulp.series(
    "build",
    (done) => {
      // Serve files from the root of this project
      browserSync.init(["./dist/**/*"], {
        ghostMode: {
          clicks: false,
          forms: false,
          scroll: false,
        },
        server: {
          baseDir: "./dist",
        },
        startPath: "/ub/" + htmlFileName + ".html", // 指定默认打开的页面
        notify: false,
      });

      done();
    },
    "watch"
  )
);


gulp.task("deploy:ftp", (done) => {
  const conn = ftp.create(ftpConfig);
  const distFolders = [
    { local: "./dist/ub/", remote: "/ubackup.com/landing/" },
    { local: "./dist/ub/de/", remote: "/ubackup.com/de/landing/" },
    { local: "./dist/ub/fr/", remote: "/ubackup.com/fr/landing/" },
    { local: "./dist/ub/es/", remote: "/ubackup.com/es/landing/" },
    { local: "./dist/ub/it/", remote: "/ubackup.com/it/landing/" },
    { local: "./dist/ub/jp/", remote: "/ubackup.com/jp/landing/" },
    { local: "./dist/ub/tw/", remote: "/ubackup.com/tw/landing/" },
    { local: "./dist/dp/", remote: "/diskpart.com/landing/" },
    { local: "./dist/dp/de/", remote: "/diskpart.com/de/landing/" },
    { local: "./dist/dp/fr/", remote: "/diskpart.com/fr/landing/" },
    { local: "./dist/dp/es/", remote: "/diskpart.com/es/landing/" },
    { local: "./dist/dp/it/", remote: "/diskpart.com/it/landing/" },
    { local: "./dist/dp/jp/", remote: "/diskpart.com/jp/landing/" },
    { local: "./dist/dp/tw/", remote: "/diskpart.com/tw/landing/" },
    { local: "./dist/at/", remote: "/aomeitech.com/landing/" },
    { local: "./dist/am-de/", remote: "/aomei.de/landing/" },
    { local: "./dist/am-fr/", remote: "/aomei.fr/landing/" },
    { local: "./dist/am-jp/", remote: "/aomei.jp/landing/" },
  ];
  distFolders.forEach((folder) => {
    gulp
      .src(folder.local + "**/*", { base: folder.local, buffer: false })
      .pipe(conn.newer(folder.remote)) // 只上传更改的文件
      .pipe(conn.dest(folder.remote)) // 上传到对应 FTP 目标目录
      .on("end", () => {
        log(`✅ 上传完成：${folder.local} → ${folder.remote}`);
      });
  });
  done();
});

gulp.task("deploy", gulp.series("build:optimized"));
