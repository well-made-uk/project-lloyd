const { join } = require(`path`)
const globby = require(`globby`)
const cheerio = require(`cheerio`)
const { readFile, outputFile } = require(`fs-extra`)
const posthtml = require(`posthtml`)
const postcss = require('postcss')
const { exists } = require('fs-extra')

let origin = process.env.WEBFLOW_URL
let target = process.env.URL
target = target.replace(/^https?:\/\//,'')
if(origin[origin.length - 1] !== `/`) {
	origin += `/`
}

function toBool(str){
	const type = typeof str
	if(type === `boolean`) {
		return str
	}
	if(type === `string`) {
		if(
			str === `true` ||
			str === `yes` ||
			str === `on` ||
			str === `1`
		) {
			return true
		}
		return false
	}
	return !!str
}

// Check for feature flags
let replaceRobotsTxt = toBool(process.env.REPLACE_ROBOTS_TXT)

module.exports = function webflowPlugin(){
	let excludeFromSitemap = []

	return function(){

		this.on(`parseHtml`, ({ $, url }) => {
			const $body = $(`body`)
			const $head = $(`head`)
			const $html = $(`html`)

			// Add lang attrbute
			if(!$html.attr(`lang`)){
				$html.attr(`lang`, `en`)
			}

			// Improve generator meta
			$head.find(`meta[name="generator"]`).remove()
			$head.append(`<meta name="generator" content="Project Lloyd" data-url="https://github.com/well-made-uk/project-lloyd"`)

			// Remove Webflow mess
			$head.find(`style:nth-child(1)`).remove()
			$html.removeAttr("data-wf-page")
			$html.removeAttr("data-wf-site")
			$html.removeAttr("data-wf-status")
			$html.removeAttr("class")
			$html.removeAttr(`data-wf-domain`)
			$html.append(`<style>.w-webflow-badge {display:none!important}</style>`)

			// Add Analytics
			if (process.env.plausible) {
				$head.append(`<script defer data-domain="` + target + `" src="https://plausible.io/js/plausible.js"></script>`)
			}

			// Remove HTML comments
			$('*').each((i, el) => {
				const $el = $(el)
				if( $el.nodeType === 8 ) {
				  $el.remove()
				}
			})

			// Fix cross-origin links
			$(`a`).each((i, el) => {
				const $el = $(el)
				const href = $el.attr(`href`)
				if(href){
					if (href.indexOf(`://`) > -1) {
						$el.attr(`rel`, `noopener noreferrer`)
					}
					// Make internal links external
					if (!process.env.BCP) {
						$el.attr(`href`, `${origin}${href.replace(`/`, ``)}`)
					}
				}
			})

			// Find links to remove from sitemap
			let includeInSitemap = $body.attr(`sitemap`)
			if(includeInSitemap){
				$body.removeAttr(`sitemap`)
			}
			if(includeInSitemap === `false` || includeInSitemap === `0` || includeInSitemap === `no`){
				includeInSitemap = false
			}
			else{
				includeInSitemap = true
			}
			if(!includeInSitemap){
				excludeFromSitemap.push(url)
			}


		})
/*
		// Need to output as `{{name}}.html` instead of `index.html` for pretty URLs
		this.on(`writeFile`, async obj => {
			const dist = this.dist
			let { outputPath } = obj

			// Split path into parts
			const parts = outputPath.replace(dist, ``).split(`/`)
			const name = parts.pop()
			const dir = parts.pop()
			if(name === `index.html` && dir){
				obj.outputPath = dist + parts.join(`/`) + `/` + dir + `.html`
			}
		})
*/
		this.on(`complete`, async () => {
			const dist = this.dist
			const PUBLISH_DIR = join(process.cwd(), dist)

			// Create robots.txt if it doesn't exist
			const newRobotsTxt = replaceRobotsTxt || !(await exists(join(dist, `robots.txt`)))
			if (newRobotsTxt) {
				console.log(`Creating robots.txt...`)
				await outputFile(join(dist, `robots.txt`), ``)
			}

			// Remove excluded pages from sitemap
			excludeFromSitemap = excludeFromSitemap.map(url => {
				url = this.convertUrl(url)
				return url
			})
			const xmlFiles = await globby(join(dist, `**/*.xml`))

			for(let xmlPath of xmlFiles){
				const xmlStr = await readFile(xmlPath, `utf8`)
				const $ = cheerio.load(xmlStr, {
					decodeEntities: false,
					xmlMode: true,
				})
				$(`url`).each((_, el) => {
					const $url = $(el)
					const loc = $url.find(`loc`)
					const url = loc.text().trim()
					if(excludeFromSitemap.indexOf(url) > -1){
						$url.remove()
					}
				})
				const newXml = $.xml()
				console.log(`Writing new Sitemap...`)
				await outputFile(xmlPath, newXml)
			}


			// Write redirects file
			let origin = process.env.WEBFLOW_URL
			while(origin[origin.length - 1] === `/`){
				origin = origin.substring(0, origin.length - 1)
			}
			const template = await readFile(join(__dirname, `_redirects.template`), `utf8`)
			let redirectsData = template.replace(/{{domain}}/g, origin)
			await outputFile(join(dist, `_redirects`), redirectsData)

		})
	}
}
