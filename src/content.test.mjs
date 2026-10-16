import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cvFontWarnings, pdfMonth, readSite, validateSite } from './content.mjs';
import { cvFace } from './cvfonts.mjs';
import { escapeHtml, photoWidths, renderPage } from './template.mjs';

// The build's own reader, so cv.updated falls back to the committed PDF's date exactly as in a build.
const { site, cvWarnings } = await readSite();
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

test('the CV month comes from the PDF ModDate, then CreationDate', () => {
	assert.equal(pdfMonth(Buffer.from('/CreationDate (D:20250101) /ModDate (D:20260825165544)')), '2026-08');
	assert.equal(pdfMonth(Buffer.from('/ModDate(D:202601) ... /ModDate (D:202603)')), '2026-03');
	assert.equal(pdfMonth(Buffer.from('/CreationDate (D:20241105)')), '2024-11');
	assert.equal(pdfMonth(Buffer.from('/ModDate (D:20241305)')), undefined);
	assert.equal(pdfMonth(Buffer.from('%PDF-1.7 no info')), undefined);
});

test('cv.updated sets the dated download name and label', () => {
	const dated = { ...site, cv: { ...site.cv, updated: '2026-08' } };
	validateSite(dated);
	const html = renderPage(dated, assets, 'cv');
	assert.ok(html.includes('download="Aneesh_Raghunandan_CV_2026-08.pdf"'));
	assert.ok(html.includes('<p>Updated August 2026</p>'));
	assert.throws(() => validateSite({ ...site, cv: { ...site.cv, updated: '2026-13' } }), /cv\.updated must be year-month/);
});

test('working papers reject volume and year; citation fields reject trailing punctuation', () => {
	const broken = structuredClone(site);
	broken.working_papers[0].year = '2025';
	assert.throws(() => validateSite(broken), /working_papers\[0\]\.year is not a known field/);
	const dotted = structuredClone(site);
	dotted.publications[2].year = '2025.';
	assert.throws(() => validateSite(dotted), /publications\[2\]\.year must not end in/);
});

test('CV font names map to the body font\'s faces', () => {
	assert.deepEqual(cvFace('SXGZPZ+CMBX12'), { fontWeight: 'bold' });
	assert.deepEqual(cvFace('CMTI10'), { fontStyle: 'italic' });
	assert.deepEqual(cvFace('APXPCB+CMCSC10'), { fontVariant: 'small-caps' });
	assert.deepEqual(cvFace('CMR10'), {});
	assert.deepEqual(cvFace('LMRoman10-BoldItalic'), { fontWeight: 'bold', fontStyle: 'italic' });
	assert.deepEqual(cvFace('TimesNewRomanPS-ItalicMT'), { fontStyle: 'italic' });
	assert.deepEqual(cvFace('MinionPro-BoldIt'), { fontWeight: 'bold', fontStyle: 'italic' });
	assert.deepEqual(cvFace('Calibri'), {});
});

test('the build warns about CVs not set in Computer Modern', async () => {
	assert.deepEqual(cvWarnings, []);
	const font = (dict) => `1 0 obj << /Type /Font ${dict} >> endobj`;
	assert.match(cvFontWarnings(Buffer.from(font('/Subtype /TrueType /BaseFont /ABCDEF+Calibri-Bold') + font('/Subtype /Type1 /BaseFont /CMR10')), 'cv.pdf')[0], /Computer Modern.*: Calibri-Bold \(bold\)\. /);
	assert.match(cvFontWarnings(Buffer.from('%PDF-1.7 /ObjStm'), 'cv.pdf')[0], /compressed/);
	assert.match(cvFontWarnings(Buffer.from(font('/Subtype /Type3 /FirstChar 32 /LastChar 122')), 'cv.pdf')[0], /1 font\(s\) as shapes/);
	assert.deepEqual(cvFontWarnings(Buffer.from(font('/Subtype /Type3 /FirstChar 136 /LastChar 136')), 'cv.pdf'), []);
});
