// Builds the site into _site/: renders index.html from content/site.json, minifies CSS/JS with hashed names, copies static files.
import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { transform } from 'esbuild';
import { validateSite } from './src/content.mjs';
import { renderPage } from './src/template.mjs';

const OUT = '_site';
// Order matters: same cascade as the three <link> tags this replaced.
const CSS_FILES = ['assets/css/font_Yanone_Kaffeesatz.css', 'assets/css/reset.css', 'assets/css/main.css'];
const JS_FILE = 'assets/js/script.js';
const STATIC_FILES = ['CNAME', 'assets/favicon.png', 'assets/img'];
// Stable public URL for the CV, whatever site.json's cv.file is called.
const CV_URL = '/Aneesh_Raghunandan_CV.pdf';

async function readSite() {
	const text = await readFile('content/site.json', 'utf8');
	let site;
	try {
		site = JSON.parse(text);
	} catch (error) {
		throw new Error(`content/site.json is not valid JSON: ${error.message}`);
	}
	validateSite(site);
	for (const [field, file] of [['photo', site.photo], ['cv.file', site.cv.file]]) {
		await access(file).catch(() => {
			throw new Error(`content/site.json: ${field} points to "${file}", which does not exist`);
		});
	}
	return site;
}

// Writes `code` to dir/name.<hash>.ext and returns its site-relative URL.
async function writeHashed(dir, name, ext, code) {
	const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
	const url = `${dir}/${name}.${hash}.${ext}`;
	await mkdir(join(OUT, dir), { recursive: true });
	await writeFile(join(OUT, url), code);
	return url;
}

async function minify(files, loader) {
	const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
	const { code } = await transform(source, { loader, minify: true, sourcefile: files.join('+'), logLevel: 'warning' });
	return code;
}

async function copyTo(src, dest) {
	await mkdir(dirname(join(OUT, dest)), { recursive: true });
	await cp(src, join(OUT, dest), { recursive: true });
}

async function build() {
	const site = await readSite();
	await rm(OUT, { recursive: true, force: true });
	const assets = {
		css: await writeHashed('assets/css', 'site', 'css', await minify(CSS_FILES, 'css')),
		js: await writeHashed('assets/js', 'script', 'js', await minify([JS_FILE], 'js')),
		favicon: 'assets/favicon.png',
		cv: CV_URL,
	};
	await Promise.all(STATIC_FILES.map((file) => copyTo(file, file)));
	// After STATIC_FILES, since the photo may sit inside assets/img and parallel copies of one file can race.
	await Promise.all([copyTo(site.photo, site.photo), copyTo(site.cv.file, CV_URL)]);
	await writeFile(join(OUT, 'index.html'), renderPage(site, assets));
	console.log(`Built ${OUT}/ (index.html, ${assets.css}, ${assets.js})`);
}

build().catch((error) => {
	console.error(`\nBuild failed: ${error.message}\n`);
	process.exit(1);
});
