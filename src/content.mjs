// Checks content/site.json and throws one readable error per problem, naming the field path.

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAPER_KEYS = ['title', 'url', 'coauthors', 'venue', 'volume', 'year', 'status', 'notes_html'];

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

function checkPaper(paper, path) {
	checkKeys(paper, path, PAPER_KEYS);
	checkString(paper.title, `${path}.title`);
	checkUrl(paper.url, `${path}.url`);
	for (const key of ['coauthors', 'venue', 'volume', 'year', 'status']) {
		checkString(paper[key], `${path}.${key}`, { optional: true });
	}
	checkStringList(paper.notes_html, `${path}.notes_html`, { optional: true });
}

function checkPublication(paper, path) {
	checkPaper(paper, path);
	checkString(paper.venue, `${path}.venue`);
	// A publication shows either "status, venue" (e.g. Forthcoming) or "venue volume, year".
	if (paper.status === undefined) {
		checkString(paper.volume, `${path}.volume`);
		checkString(paper.year, `${path}.year`);
	}
}

function checkWorkingPaper(paper, path) {
	checkPaper(paper, path);
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
