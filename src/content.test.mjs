import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateSite } from './content.mjs';
import { escapeHtml, photoWidths, renderPage } from './template.mjs';

const site = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
const photo = [180, 270, 360].map((width) => ({ url: `/assets/img/photo-${width}.abc.webp`, width, height: width }));
const assets = { styles: 'p{}', js: '/a.js', favicon: '/f.png', cv: '/Aneesh_Raghunandan_CV.pdf', origin: 'https://example.com', photo };

test('the committed site.json is valid', () => {
	validateSite(site);
});

test('a paper without a title fails with its path', () => {
	const broken = structuredClone(site);
	delete broken.publications[2].title;
	assert.throws(() => validateSite(broken), /publications\[2\]\.title must be a non-empty/);
});

test('a misspelled field is rejected', () => {
	const broken = structuredClone(site);
	broken.working_papers[0].coauthor = broken.working_papers[0].coauthors;
	assert.throws(() => validateSite(broken), /working_papers\[0\]\.coauthor is not a known field/);
});

test('photo sizes never upscale the source', () => {
	assert.deepEqual(photoWidths(1000), [180, 270, 360]);
	assert.deepEqual(photoWidths(360), [180, 270, 360]);
	assert.deepEqual(photoWidths(300), [180, 270, 300]);
	assert.deepEqual(photoWidths(100), [100]);
});

test('the photo renders as a srcset sized from the largest file', () => {
	assert.throws(() => validateSite({ ...site, photo: ['content/photo.jpg'] }), /photo must be a non-empty text/);
	const html = renderPage(site, assets, 'about');
	assert.ok(html.includes('srcset="/assets/img/photo-180.abc.webp 180w, /assets/img/photo-270.abc.webp 270w, /assets/img/photo-360.abc.webp 360w"'));
	assert.ok(html.includes('src="/assets/img/photo-360.abc.webp"'));
	assert.ok(html.includes('width="360" height="360" fetchpriority="high"'));
});

test('plain fields are escaped, _html fields are not', () => {
	const tricky = structuredClone(site);
	tricky.publications[0].title = 'A <b> & "B"';
	const html = renderPage(tricky, assets, 'research');
	assert.ok(html.includes('A &lt;b&gt; &amp; &quot;B&quot;'));
	assert.ok(html.includes('<a href="https://som.yale.edu/'));
	assert.equal(escapeHtml(`<'&">`), '&lt;&#39;&amp;&quot;&gt;');
});

test('cv.updated sets the dated download name and label', () => {
	const html = renderPage(site, assets, 'cv');
	assert.ok(html.includes(`download="Aneesh_Raghunandan_CV_${site.cv.updated}.pdf"`));
	assert.match(html, /<p>Updated [A-Z][a-z]+ \d{4}<\/p>/);
	assert.throws(() => validateSite({ ...site, cv: { ...site.cv, updated: '2026-13' } }), /cv\.updated must be year-month/);
});
