// Checks content/site.json and throws one readable error per problem, naming the field path.

import { baseFontName, cvFace, isComputerModern } from './cvfonts.mjs';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAPER_KEYS = ['title', 'url', 'coauthors', 'venue', 'volume', 'year', 'status', 'notes_html'];
// Working papers never show a volume or year.
const WORKING_PAPER_KEYS = PAPER_KEYS.filter((key) => key !== 'volume' && key !== 'year');

function fail(path, message) {
	throw new Error(`content/site.json: ${path} ${message}`);
}

function checkKeys(obj, path, allowed) {
	if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) fail(path, 'must be an object {...}');
	for (const key of Object.keys(obj)) {
		if (!allowed.includes(key)) fail(`${path}.${key}`, `is not a known field (expected one of: ${allowed.join(', ')})`);
	}
}

function checkString(value, path, { optional = false } = {}) {
	if (value === undefined && optional) return;
	if (typeof value !== 'string' || value.trim() === '') fail(path, 'must be a non-empty text value in "quotes"');
}

function checkStringList(value, path, { optional = false } = {}) {
	if (value === undefined && optional) return;
	if (!Array.isArray(value) || value.length === 0) fail(path, 'must be a non-empty list [...]');
	value.forEach((item, i) => checkString(item, `${path}[${i}]`));
}

function checkUrl(value, path) {
	checkString(value, path, { optional: true });
	if (value !== undefined && !/^https?:\/\//.test(value)) fail(path, 'must start with https:// or http://');
}

function checkPaper(paper, path, keys) {
	checkKeys(paper, path, keys);
	checkString(paper.title, `${path}.title`);
	checkUrl(paper.url, `${path}.url`);
	for (const key of ['coauthors', 'venue', 'volume', 'year', 'status']) {
		checkString(paper[key], `${path}.${key}`, { optional: true });
		// The page adds the punctuation between these ("venue 63(2), 2025").
		if (key !== 'coauthors' && /[.,;:]$/.test(paper[key] ?? '')) fail(`${path}.${key}`, 'must not end in . , ; or :');
	}
	checkStringList(paper.notes_html, `${path}.notes_html`, { optional: true });
}

function checkPublication(paper, path) {
	checkPaper(paper, path, PAPER_KEYS);
	checkString(paper.venue, `${path}.venue`);
	// A publication shows either "status, venue" (e.g. Forthcoming) or "venue volume, year".
	if (paper.status === undefined) {
		checkString(paper.volume, `${path}.volume`);
		checkString(paper.year, `${path}.year`);
	}
}

function checkWorkingPaper(paper, path) {
	checkPaper(paper, path, WORKING_PAPER_KEYS);
	if ((paper.status === undefined) !== (paper.venue === undefined)) fail(path, 'needs both "status" and "venue", or neither');
}

function checkPaperList(list, path, checkOne) {
	if (!Array.isArray(list)) fail(path, 'must be a list [...]');
	list.forEach((paper, i) => checkOne(paper, `${path}[${i}]`));
}

/** Throws an Error naming the first missing or invalid field in the parsed site.json. */
export function validateSite(site) {
	checkKeys(site, 'top level', ['name', 'email', 'address', 'photo', 'about_html', 'interests', 'publications', 'working_papers', 'cv']);
	checkKeys(site.name, 'name', ['first', 'last']);
	checkString(site.name.first, 'name.first');
	checkString(site.name.last, 'name.last');
	checkString(site.email, 'email');
	if (!/^[^@\s]+@[^@\s]+$/.test(site.email)) fail('email', 'must look like name@example.edu');
	checkStringList(site.address, 'address');
	// One source image; build.mjs resizes it (and fails if it is not an image).
	checkString(site.photo, 'photo');
	checkStringList(site.about_html, 'about_html');
	checkString(site.interests, 'interests');
	checkPaperList(site.publications, 'publications', checkPublication);
	checkPaperList(site.working_papers, 'working_papers', checkWorkingPaper);
	checkKeys(site.cv, 'cv', ['file', 'updated']);
	checkString(site.cv.file, 'cv.file');
	// Optional: overrides the date build.mjs reads from the PDF.
	checkString(site.cv.updated, 'cv.updated', { optional: true });
	if (site.cv.updated !== undefined && !MONTH.test(site.cv.updated)) fail('cv.updated', 'must be year-month like "2026-08"');
}

/** Returns "YYYY-MM" from the PDF's ModDate (else CreationDate), or undefined if it has neither. */
export function pdfMonth(bytes) {
	const text = Buffer.from(bytes).toString('latin1');
	for (const key of ['ModDate', 'CreationDate']) {
		// The last match wins: an edited PDF appends a newer info dictionary.
		const month = [...text.matchAll(new RegExp(`/${key}\\s*\\(D:(\\d{4})(\\d{2})`, 'g'))].map(([, y, m]) => `${y}-${m}`).pop();
		if (month && MONTH.test(month)) return month;
	}
	return undefined;
}

// A Type3 font with this many characters or more is text drawn as shapes, not a lone symbol such as LaTeX's bullet.
const TYPE3_TEXT_CHARS = 3;

/**
 * Returns warnings for a CV the viewer may show imperfectly: fonts it cannot read, fonts other than LaTeX's
 * Computer Modern (styled by name), and text drawn as shapes. Reads only uncompressed font objects, like pdfMonth.
 */
export function cvFontWarnings(bytes, file) {
	const fonts = Buffer.from(bytes).toString('latin1').split('endobj').filter((obj) => /\/Type\s*\/Font\b/.test(obj));
	if (fonts.length === 0) return [`${file}: its fonts are compressed, so the build could not check them. After the deploy, check that bold, italics and symbols look right on the CV tab.`];
	const warnings = [];
	const names = [...new Set(fonts.map((obj) => obj.match(/\/BaseFont\s*\/([^\s/<>[\]()]+)/)?.[1]).filter(Boolean))];
	const other = names.filter((name) => !isComputerModern(name));
	if (other.length > 0) {
		const styled = other.map((name) => `${baseFontName(name)} (${Object.values(cvFace(name)).join(' ') || 'regular'})`);
		warnings.push(`${file} is not set in LaTeX's Computer Modern fonts. The CV tab shows its text in the site font, styled from each font's name: ${styled.join(', ')}. After the deploy, check the CV tab.`);
	}
	const shapes = fonts.filter((obj) => {
		const range = /\/Subtype\s*\/Type3\b[\s\S]*\/FirstChar\s+(\d+)\s*\/LastChar\s+(\d+)/.exec(obj);
		return range && range[2] - range[1] + 1 >= TYPE3_TEXT_CHARS;
	});
	if (shapes.length > 0) warnings.push(`${file} draws text in ${shapes.length} font(s) as shapes (Type3). That text shows in the PDF's own lettering, not the site font.`);
	return warnings;
}
