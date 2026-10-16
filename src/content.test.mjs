import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateSite } from './content.mjs';
import { escapeHtml, renderPage } from './template.mjs';

const site = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
const assets = { css: 'a.css', js: 'a.js', favicon: 'f.png' };

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

test('plain fields are escaped, _html fields are not', () => {
	const tricky = structuredClone(site);
	tricky.publications[0].title = 'A <b> & "B"';
	const html = renderPage(tricky, assets);
	assert.ok(html.includes('A &lt;b&gt; &amp; &quot;B&quot;'));
	assert.ok(html.includes('<a href="https://som.yale.edu/'));
	assert.equal(escapeHtml(`<'&">`), '&lt;&#39;&amp;&quot;&gt;');
});
