# Project Lloyd

Version: 1.0.1

Lloyd is a generator that converts a Webflow website into a static site by scraping any content found from the origin. Postprocessing is done to perform optimizations on the downloaded content:

- Prettify URLs
- Prepare for Plausible
- Minify and bundle all Webflow CSS and JS
- Optimise images
- Optimise and subset font files

This is then deployed in Netlify.

## Usage

Make sure you have 2 environment variables set:

- `URL`: The destination URL
- `WEBFLOW_URL`: The original source URL to be scraped

Do this in the `.env` file.

Then run:

```bash
yarn build
```

It should output the files to the `public` folder in the project root. You can test the site out locally by running:

```bash
yarn serve
```

# Excluding pages from the sitemap

In Webflow, add this custom attribute to the "body" tag of the page you want to exclude from the sitemap:

Name: `sitemap`
Value: `no`
