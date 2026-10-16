import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { pathForHash, tabForPath } from './tabs.mjs';

test('paths map to tabs, with or without the trailing slash or index.html', () => {
	assert.equal(tabForPath('/'), 'about');
	assert.equal(tabForPath('/index.html'), 'about');
	assert.equal(tabForPath('/research/'), 'research');
	assert.equal(tabForPath('/research'), 'research');
	assert.equal(tabForPath('/cv/index.html'), 'cv');
	assert.equal(tabForPath('/nope/'), null);
	assert.equal(tabForPath('/cv/extra'), null);
});

test('old tab hashes map to paths; other hashes do not', () => {
	assert.equal(pathForHash('#about'), '/');
	assert.equal(pathForHash('#research'), '/research/');
	assert.equal(pathForHash('#cv'), '/cv/');
	for (const hash of ['', '#', '#CV', '#cv/', '#content', '#%3Cx%3E']) assert.equal(pathForHash(hash), null);
});

test('the build writes one page per tab with that tab active', async () => {
	await promisify(execFile)(process.execPath, ['build.mjs'], { cwd: new URL('..', import.meta.url) });
	const pages = [
		['index.html', 'about', '/', 'Aneesh Raghunandan'],
		['research/index.html', 'research', '/research/', 'Research · Aneesh Raghunandan'],
		['cv/index.html', 'cv', '/cv/', 'CV · Aneesh Raghunandan'],
	];
	for (const [file, id, path, title] of pages) {
		const html = await readFile(new URL(`../_site/${file}`, import.meta.url), 'utf8');
		assert.ok(html.includes(`<title>${title}</title>`), file);
		assert.ok(html.includes(`<link rel="canonical" href="https://www.aneeshraghunandan.com${path}">`), file);
		assert.ok(html.includes(`<li class="active"><a href="${path}" data-title="${title}" aria-current="page">`), file);
		assert.equal(html.match(/aria-current/g).length, 1, file);
		for (const pane of ['about', 'research', 'cv']) {
			assert.ok(html.includes(`<div id="${pane}"${pane === id ? '' : ' hidden'}>`), `${file} #${pane}`);
		}
		assert.ok(html.includes('static.cloudflareinsights.com/beacon.min.js'), file);
		assert.doesNotMatch(html, /(src|href)="(?!\/|https:|mailto:|#)/, `${file} has a relative URL`);
	}
	const notFound = await readFile(new URL('../_site/404.html', import.meta.url), 'utf8');
	assert.ok(notFound.includes('<div id="about">') && notFound.includes('class="not-found"'));
});
