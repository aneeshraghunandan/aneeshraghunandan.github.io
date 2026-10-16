// Builds the site into _site/: renders a page per tab (index.html, research/, cv/) and 404.html from content/site.json, inlines minified CSS, bundles JS with a hashed name, copies static files.
import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { build as bundle, transform } from 'esbuild';
import sharp from 'sharp';
import { pdfMonth, validateSite } from './src/content.mjs';
import { TABS } from './src/tabs.mjs';
import { photoWidths, renderPage } from './src/template.mjs';

const OUT = '_site';
// Order matters: the @font-face rules come first.
const CSS_FILES = ['assets/css/font_Yanone_Kaffeesatz.css', 'assets/css/main.css'];
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
	site.cv.updated ??= pdfMonth(await readFile(site.cv.file));
	if (!site.cv.updated) throw new Error(`${site.cv.file} has no creation date; set cv.updated in content/site.json, e.g. "2026-08"`);
	return site;
}

// Writes `code` to dir/name.<hash>.ext and returns its root-absolute URL.
async function writeHashed(dir, name, ext, code) {
	const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
	const url = `${dir}/${name}.${hash}.${ext}`;
	await mkdir(join(OUT, dir), { recursive: true });
	await writeFile(join(OUT, url), code);
	return `/${url}`;
}

// script.js imports src/tabs.mjs, so it is bundled into one classic script.
async function bundleJs(entry) {
	const { outputFiles } = await bundle({ entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, logLevel: 'warning' });
	return outputFiles[0].text;
}

async function minify(files, loader) {
	const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
	const { code } = await transform(source, { loader, minify: true, sourcefile: files.join('+'), logLevel: 'warning' });
	return code;
}

// Writes the photo as hashed WebP files at photoWidths() and returns [{ url, width, height }], smallest first.
async function buildPhoto(file) {
	// autoOrient applies EXIF rotation, so phone photos come out upright.
	const metadata = await sharp(file, { autoOrient: true }).metadata().catch((error) => {
		throw new Error(`content/site.json: photo "${file}" is not a readable image (${error.message})`);
	});
	const { width, height } = metadata.autoOrient;
	return Promise.all(photoWidths(width).map(async (size) => {
		const webp = await sharp(file, { autoOrient: true }).resize(size).webp().toBuffer();
		return { url: await writeHashed('assets/img', `photo-${size}`, 'webp', webp), width: size, height: Math.round((height * size) / width) };
	}));
}

async function copyTo(src, dest) {
	await mkdir(dirname(join(OUT, dest)), { recursive: true });
	await cp(src, join(OUT, dest), { recursive: true });
}

async function build() {
	const site = await readSite();
	await rm(OUT, { recursive: true, force: true });
	const assets = {
		// Inlined into each page: at ~5 KB it costs less than a render-blocking request.
		styles: await minify(CSS_FILES, 'css'),
		js: await writeHashed('assets/js', 'script', 'js', await bundleJs(JS_FILE)),
		favicon: '/assets/favicon.png',
		cv: CV_URL,
		origin: `https://${(await readFile('CNAME', 'utf8')).trim()}`,
	};
	await Promise.all(STATIC_FILES.map((file) => copyTo(file, file)));
	// After STATIC_FILES, which copies assets/img, so the copy and the photo writes cannot race.
	[assets.photo] = await Promise.all([buildPhoto(site.photo), copyTo(site.cv.file, CV_URL)]);
	const pages = [...TABS.map(({ id, path }) => [id, `${path}index.html`]), ['not-found', '/404.html']];
	await Promise.all(pages.map(async ([page, file]) => {
		await mkdir(dirname(join(OUT, file)), { recursive: true });
		await writeFile(join(OUT, file), renderPage(site, assets, page));
	}));
	console.log(`Built ${OUT}/ (${pages.map(([, file]) => file.slice(1)).join(', ')}, inline CSS, ${assets.js})`);
}

build().catch((error) => {
	console.error(`\nBuild failed: ${error.message}\n`);
	process.exit(1);
});
