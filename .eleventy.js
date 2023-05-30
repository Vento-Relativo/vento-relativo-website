const { DateTime } = require("luxon");
const CleanCSS = require("clean-css");
const UglifyJS = require("uglify-js");
const htmlmin = require("html-minifier");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const bundlerPlugin = require("@11ty/eleventy-plugin-bundle");
const Image = require("@11ty/eleventy-img");
const externalLinks = require('eleventy-plugin-external-links');
const postcss = require('postcss');
const postcssNesting = require('postcss-nesting');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano')

module.exports = function (eleventyConfig) {

  // Eleventy Navigation https://www.11ty.dev/docs/plugins/navigation/
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  eleventyConfig.addPlugin(bundlerPlugin, {
    transforms: [
      async function (code) {
        // this.type returns the bundle name.
        if (this.type === 'css') {
          // Same as Eleventy transforms, this.page is available here.
          let result = await postcss([
            postcssNesting,
            autoprefixer,
            cssnano
          ]).process(code, { from: this.page.inputPath, to: null });
          return result.css;
        }
        if (this.type === 'js') {
          let minified = UglifyJS.minify(code);
          if (minified.error) {
            console.log("UglifyJS error: ", minified.error);
            return code;
          }
          return minified.code;
        }

        return code;
      }
    ]
  });

  // Configuration API: use eleventyConfig.addLayoutAlias(from, to) to add
  // layout aliases! Say you have a bunch of existing content using
  // layout: post. If you don’t want to rewrite all of those values, just map
  // post to a new file like this:
  // eleventyConfig.addLayoutAlias("post", "layouts/my_new_post_layout.njk");

  // Merge data instead of overriding
  // https://www.11ty.dev/docs/data-deep-merge/
  eleventyConfig.setDataDeepMerge(true);

  // Add support for maintenance-free post authors
  // Adds an authors collection using the author key in our post frontmatter
  // Thanks to @pdehaan: https://github.com/pdehaan
  eleventyConfig.addCollection("authors", collection => {
    const blogs = collection.getFilteredByGlob("posts/*.md");
    return blogs.reduce((coll, post) => {
      const author = post.data.author;
      if (!author) {
        return coll;
      }
      if (!coll.hasOwnProperty(author)) {
        coll[ author ] = [];
      }
      coll[ author ].push(post.data);
      return coll;
    }, {});
  });

  // Date formatting (human readable)
  eleventyConfig.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj).toFormat("dd LLL yyyy");
  });

  // Date formatting (machine readable)
  eleventyConfig.addFilter("machineDate", dateObj => {
    return DateTime.fromJSDate(dateObj).toFormat("yyyy-MM-dd");
  });

  // PostCSS => https://github.com/11ty/eleventy/issues/518#issuecomment-489033990
  eleventyConfig.addNunjucksAsyncFilter("postcss", function (cssCode, callback) {
    postcss([
      postcssNesting,
      autoprefixer,
      cssnano
    ])
      .process(cssCode)
      .then(function (result) {
        callback(null, result.css);
      });
  });

  // Minify CSS
  eleventyConfig.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // Minify JS
  eleventyConfig.addFilter("jsmin", function (code) {
    let minified = UglifyJS.minify(code);
    if (minified.error) {
      console.log("UglifyJS error: ", minified.error);
      return code;
    }
    return minified.code;
  });

  // Array/Object to inline JS https://www.aleksandrhovhannisyan.com/blog/useful-11ty-filters/#2-working-with-json
  eleventyConfig.addFilter('fromJson', JSON.parse);
  eleventyConfig.addFilter('toJson', JSON.stringify);

  // Custom function writing an array of coordinates with fixed format
  eleventyConfig.addFilter('adjustCoordinates', (coordArray) => {
    return JSON.stringify(coordArray.map((to) => to.split(' ').join('') // remove spaces
      .split(',').reverse())) // flip the coordinates
  });

  // eleventyConfig.addShortcode("image", async function(src, alt, sizes) {
	// 	let metadata = await Image(src, {
  //     urlPath: "/static/img/",
  //     outputDir: "./_site/static/img/",
  //     // svgShortCircuit: true,
	// 		// widths: [300],
	// 		formats: ["svg"]
	// 	});
	// 	let imageAttributes = {
	// 		alt,
	// 		sizes,
	// 		loading: "lazy",
	// 		decoding: "async",
	// 	};
	// 	// You bet we throw an error on a missing alt (alt="" works okay)
	// 	return Image.generateHTML(metadata, imageAttributes);
	// });

  // Inline SVG shortcode: https://medium.com/@brettdewoody/inlining-svgs-in-eleventy-cffb1114e7b
  eleventyConfig.addShortcode('svgInline', async (src, alt, sizes) => {
    let metadata = await Image(src, {
      formats: ['svg'],
      dryRun: true,
    })
    return metadata.svg[0].buffer.toString()
  })

  // Minify HTML output
  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (outputPath.indexOf(".html") > -1) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true
      });
      return minified;
    }
    return content;
  });

  // Don't process folders with static assets e.g. images
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("static");
  eleventyConfig.addPassthroughCopy("admin/");
  // We additionally output a copy of our CSS for use in Netlify CMS previews
  eleventyConfig.addPassthroughCopy("_includes/assets/css/critical.css");

  /* Markdown Plugins */
  let markdownIt = require("markdown-it");
  let markdownItAnchor = require("markdown-it-anchor");
  let options = {
    html: true,  // Enable HTML tags in source
    breaks: true, // Convert line breaks into <br>
    linkify: true, // Autoconvert URLs to links
    typographer: true, // Enable some language-neutral replacement + quotes beautification
  };
  let opts = {
    // permalink: true,
    permalink: markdownItAnchor.permalink.linkInsideHeader({
      symbol: `
        <span class="visually-hidden">Jump to heading</span>
        <svg aria-hidden="true" height="16" width="16"><use xlink:href="#icon-link"></use></svg>
      `,
    })
  };

  eleventyConfig.setLibrary("md", markdownIt(options)
    .use(markdownItAnchor, opts)
    // .use(markdownItGHeadings)
  );

  eleventyConfig.addPlugin(externalLinks);

  return {
    templateFormats: [ "md", "njk", "liquid" ],

    // If your site lives in a different subdirectory, change this.
    // Leading or trailing slashes are all normalized away, so don’t worry about it.
    // If you don’t have a subdirectory, use "" or "/" (they do the same thing)
    // This is only used for URLs (it does not affect your file structure)
    pathPrefix: "/",

    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
