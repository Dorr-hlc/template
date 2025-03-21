const autoprefixer = require("gulp-autoprefixer");
const browserSync = require("browser-sync").create();
const cache = require("gulp-cached");
const cp = require("child_process");
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
const htmlFileName = "2025-ceshi-1";
const gulpData = require("gulp-data");
const crypto = require("crypto");
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
    .src("./src/less/**/*.less") // 监控 less 文件
    .pipe(plumber())
    .pipe(lesshint()) // 使用 gulp-lesshint 进行 lint
    .pipe(lesshint.reporter())
);
gulp.task("less:build", () =>
  gulp
    .src(["./src/less/**/*.less", "!./src/less/**/_*.less"])
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
    .pipe(gulp.dest("./dist/css/"))
);


gulp.task("less:optimized", () =>
  gulp
    .src(["./src/less/**/*.less", "!./src/less/**/_*.less"])
    .pipe(rename({ suffix: ".min" }))
    .pipe(plumber())
    .pipe(
      less({
        compress: true, // 开启压缩
      })
    )
    .pipe(autoprefixer())
    .pipe(cssnano({ compatibility: "ie8" }))
    .pipe(gulp.dest("dist/css/"))
);


gulp.task("less", gulp.series("less:lint", "less:build"));


gulp.task("js:build", () =>
  gulp
    .src("src/js/**/*.js")
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("dist/js"))
);

gulp.task("js:lint", () =>
  gulp
    .src(["./src/js/**/*.js", "!./src/js/lib/**/*.js", "Gulpfile.js"])
    .pipe(plumber())
    .pipe(eslint())
    .pipe(jshint())
    .pipe(jshint.reporter("default"))
);

gulp.task("js", gulp.series("js:lint", "js:build"));

gulp.task("images", () =>
  gulp
    .src("src/img/**/*")
    .pipe(plumber())
    // .pipe(imagemin({
    //   progressive: true,
    // }))
    .pipe(gulp.dest("./dist/img"))
);

gulp.task("images:optimized", () =>
  gulp
    .src("src/img/**/*")
    .pipe(plumber())
    .pipe(
      imagemin({
        progressive: true,
        multipass: true,
      })
    )
    .pipe(gulp.dest("./dist/img"))
);

gulp.task("resources", () =>
  gulp
    .src("src/resources/*")
    .pipe(plumber())
    .pipe(gulp.dest("./dist/resources"))
);

gulp.task("fonts", () =>
  gulp.src("src/font/*").pipe(plumber()).pipe(gulp.dest("./dist/font"))
);

gulp.task("templates", () => {
  const templateData = yaml.safeLoad(fs.readFileSync("./data.yml", "utf-8"));
  const options = {
    ignorePartials: true, // ignores the unknown footer2 partial in the handlebars template, defaults to false
    batch: ["./src/partials/"],
    helpers: {},
  };
  console.log(templateData);
  return gulp
    .src("./src/templates/**/*.hbs")
    .pipe(plumber())
    // .pipe(handlebars(templateData, options))
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
        let ymlFileName = "ub-en"; // 默认值

        if (pathParts.length === 3) {
          // 例如：ub/de/index.hbs → ub-de.yml
          const lang = pathParts[1]; // 获取语言部分：de / it
          ymlFileName = `ub-${lang}`;
        } else if (pathParts.length === 2) {
          // 例如：ub/index.hbs → ub-en.yml
          ymlFileName = "ub-en";
        }
        // 3. 构建 yml 文件路径
        const ymlFilePath = `./src/yml/${ymlFileName}.yml`;

        // 4. 读取并解析 yml 文件
        let templateData = {};
        if (fs.existsSync(ymlFilePath)) {
          try {
            templateData = yaml.safeLoad(fs.readFileSync(ymlFilePath, "utf-8"));
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
      // "data.yml",
      "./src/yml/**/*.yml",
      "events.json",
      "Gulpfile.js",
    ],
    gulp.series("templates", "reload")
  );
  gulp.watch(["./src/less/**/*.less"], gulp.series("less", "reload"));
  gulp.watch("./src/img/**/*", gulp.series("images", "reload"));
  gulp.watch(["./src/js/**/*.js", "Gulpfile.js"], gulp.series("js", "reload"));
});

gulp.task(
  "build",
  gulp.series(
    "clean",
    gulp.parallel("less", "images", "fonts", "resources", "js", "templates")
  )
);

gulp.task(
  "build:optimized",
  gulp.series(
    "clean",
    gulp.parallel(
      "less:optimized",
      "images:optimized",
      "fonts",
      "resources",
      "js",
      "templates:optimized"
    )
  )
);

gulp.task("deploy:rsync", (done) => {
  cp.exec("rsync -avuzh ./dist/* dan:/srv/example.com/public_html/", () => {
    process.stdout.write("Deployed to https://example.com\n");
    done();
  }).stdout.on("data", (data) => {
    process.stdout.write(data);
  });
});

gulp.task("deploy", gulp.series("build:optimized", "deploy:rsync"));

// use default task to launch Browsersync and watch JS files
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
