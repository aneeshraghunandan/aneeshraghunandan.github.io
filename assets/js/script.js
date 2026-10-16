import { pathForHash, tabForPath } from '../../src/tabs.mjs';

const panes = Array.from(document.querySelectorAll('#content > div'));
const links = Array.from(document.querySelectorAll('nav a'));
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149';
// Zoom is a multiple of the fit width, where each page fills the viewer.
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const box = document.getElementById('cv-pages');
// role="status": stays in the box so screen readers hear loading and failure messages.
const status = box.querySelector('.cv-pages__status');
const zoomBar = document.getElementById('cv-zoom');
const zoomOut = zoomBar.querySelector('[data-zoom="-1"]');
const zoomIn = zoomBar.querySelector('[data-zoom="1"]');
const zoomLevel = zoomBar.querySelector('.cv-zoom__level');
let cvRequested = false;
let cvPages = [];
// Each page's text, drawn as real text in the body font over the canvas.
let cvTexts = [];
let TextLayer = null;
let textTask = null;
// The CV's TeX fonts, by name, and how the substitute body font shows them.
const TEX_FACES = [[/CMBX/, 'fontWeight', 'bold'], [/CMTI|CMMI/, 'fontStyle', 'italic'], [/CMCSC/, 'fontVariant', 'small-caps']];
const cvFont = getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim();
const MAX_STRETCH = 1.15;
// TeX's spacing accents, as the combining marks that put them on a letter.
const ACCENTS = { '\u00a8': '\u0308', '\u00b4': '\u0301', '`': '\u0300', '\u02c6': '\u0302', '\u02dc': '\u0303' };
const measureCtx = document.createElement('canvas').getContext('2d');
let zoom = 1;
let drawnSize = '';
let drawId = 0;
let renderTask = null;
let drawTimer = 0;

function showFallback() {
	zoomBar.hidden = true;
	const { pdf, download } = box.dataset;
	// pdf and download come from the build (fixed path and a validated date), not from visitors.
	box.replaceChildren(status);
	status.innerHTML = `The CV pages could not be shown here. <a href="${pdf}" target="_blank" rel="noopener">View the PDF</a> or <a href="${pdf}" download="${download}">download it</a>.`;
}

// Notes which point of the pages sits mid-screen, as fractions of the page area.
function scrollAnchor() {
	const rect = box.getBoundingClientRect();
	return { x: (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth, y: (innerHeight / 2 - rect.top) / rect.height };
}

// Puts that point back mid-screen after a resize; roughly, since the padding does not scale.
function restoreScroll({ x, y }) {
	box.scrollLeft = x * box.scrollWidth - box.clientWidth / 2;
	if (y < 0 || y > 1) return;
	const rect = box.getBoundingClientRect();
	scrollBy(0, rect.top + y * rect.height - innerHeight / 2);
}

// Sizes every page for the current zoom at once, then redraws them one by one at the screen's pixel ratio.
async function drawPages() {
	const style = getComputedStyle(box);
	const fitWidth = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
	// Whole CSS pixels, so canvas.width is exactly clientWidth × devicePixelRatio.
	const width = Math.floor(fitWidth * zoom);
	const size = `${width}@${devicePixelRatio}`;
	// Hidden tab, or nothing to change (e.g. a phone's address bar only changed the height).
	if (width <= 0 || size === drawnSize) return;
	// The first draw replaces placeholders, so there is no view to keep.
	const anchor = drawnSize && scrollAnchor();
	drawnSize = size;
	const id = ++drawId;
	renderTask?.cancel();
	textTask?.cancel();
	const sizes = cvPages.map((page) => {
		const base = page.getViewport({ scale: 1 });
		return { base, height: Math.round((width * base.height) / base.width) };
	});
	const canvases = Array.from(box.querySelectorAll('canvas'));
	const layers = Array.from(box.querySelectorAll('.textLayer'));
	sizes.forEach(({ base, height }, i) => {
		Object.assign(canvases[i].style, { width: `${width}px`, height: `${height}px` });
		// The text layer is sized in CSS from --scale-factor, so the old text follows the canvas until the redraw lands.
		layers[i].style.setProperty('--scale-factor', width / base.width);
	});
	if (anchor) restoreScroll(anchor);
	for (const [i, page] of cvPages.entries()) {
		// A fresh canvas per draw: PDF.js refuses a canvas whose cancelled render has not settled yet.
		const canvas = canvases[i].cloneNode();
		canvas.width = Math.round(width * devicePixelRatio);
		canvas.height = Math.round(sizes[i].height * devicePixelRatio);
		const viewport = page.getViewport({ scale: canvas.width / sizes[i].base.width });
		const ctx = canvas.getContext('2d');
		// The text layer shows the letters, so the canvas keeps only rules, bullets and images.
		// PDF.js paints this CV's Type1 fonts with fillText; its one Type3 font (bullets) is drawn as paths and stays.
		ctx.fillText = ctx.strokeText = () => {};
		const layer = layers[i].cloneNode();
		const cssViewport = page.getViewport({ scale: width / sizes[i].base.width });
		try {
			renderTask = page.render({ canvasContext: ctx, viewport });
			await renderTask.promise;
			if (id !== drawId) return;
			textTask = new TextLayer({ textContentSource: cvTexts[i], container: layer, viewport: cssViewport });
			await textTask.render();
		} catch (error) {
			if (error?.name === 'RenderingCancelledException' || error?.name === 'AbortException') return;
			throw error;
		}
		if (id !== drawId) return;
		fitRuns(page, cvTexts[i], textTask.textDivs);
		canvases[i].replaceWith(canvas);
		layers[i].replaceWith(layer);
	}
}

// TextLayer stretches each run with scaleX to its width in the PDF, measured in the regular face.
// Bold, italic and small-caps runs show in that face of the body font, so their scaleX is measured
// again in it. A run that would stretch by more than 15% (small caps, math italic) is spaced out to
// its width instead, since stretched letters look distorted.
function fitRuns(page, textContent, divs) {
	// textDivs holds one entry per text item, in order, including empty ones it never attaches.
	textContent.items.filter((item) => item.str !== undefined).forEach((item, i) => {
		const div = divs[i];
		const face = TEX_FACES.find(([pattern]) => pattern.test(page.commonObjs.get(item.fontName).name));
		if (face) div.style[face[1]] = face[2];
		// TextLayer leaves single characters unscaled.
		if (!div.style.transform.includes('scaleX')) return;
		// Measured at 100px, so the ratio holds at every zoom.
		measureCtx.font = `${face?.[2] ?? ''} 100px ${cvFont}`;
		const width = measureCtx.measureText(item.str).width / 100;
		const scaleX = item.width / Math.hypot(item.transform[2], item.transform[3]) / width;
		const tracked = scaleX > MAX_STRETCH;
		if (tracked) div.style.letterSpacing = `${((scaleX - 1) * width) / item.str.length}em`;
		// Regular runs within range keep the scaleX TextLayer computed.
		if (face || tracked) div.style.transform = div.style.transform.replace(/scaleX\([^)]*\)/, `scaleX(${tracked ? 1 : scaleX})`);
	});
}

// TeX sets an accent as its own mark placed over the next letter ("Universit¨" then "at"), which the
// body font would show over the wrong letter and find-in-page would miss. Joins them into one run ("ät").
function joinAccents(items) {
	for (let i = items.length - 2; i >= 0; i--) {
		const [run, next] = [items[i], items[i + 1]];
		const mark = ACCENTS[run.str?.at(-1)];
		if (!mark || !next.str || Math.abs(next.transform[5] - run.transform[5]) > 1) continue;
		run.str = run.str.slice(0, -1) + (next.str[0] + mark).normalize() + next.str.slice(1);
		run.width = next.transform[4] + next.width - run.transform[4];
		run.hasEOL = next.hasEOL;
		items.splice(i + 1, 1);
	}
}

// Waits out rapid clicks and resize events before redrawing.
function scheduleDraw() {
	clearTimeout(drawTimer);
	drawTimer = setTimeout(() => drawPages().catch(showFallback), 150);
}

// Browser zoom changes devicePixelRatio; redraw so the backing store keeps matching the screen.
function watchPixelRatio() {
	matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => {
		scheduleDraw();
		watchPixelRatio();
	}, { once: true });
}

function setZoom(next) {
	zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
	// aria-disabled rather than disabled, so keyboard focus stays on the button at the limit.
	zoomOut.setAttribute('aria-disabled', zoom <= ZOOM_MIN);
	zoomIn.setAttribute('aria-disabled', zoom >= ZOOM_MAX);
	zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
	scheduleDraw();
}

zoomBar.addEventListener('click', (event) => {
	const step = event.target.closest('button')?.dataset.zoom;
	if (step === undefined) return;
	setZoom(step === '0' ? 1 : zoom + Number(step) * ZOOM_STEP);
});

// Loads PDF.js only when the CV tab first opens, then draws every page of the CV.
async function renderCv() {
	status.textContent = 'Loading CV pages...';
	try {
		const pdfjs = await import(`${PDFJS}/pdf.min.mjs`);
		({ TextLayer } = pdfjs);
		pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
		const pdf = await pdfjs.getDocument(box.dataset.pdf).promise;
		cvPages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1)));
		cvTexts = await Promise.all(cvPages.map((page) => page.getTextContent()));
		// TextLayer measures and sets each run's font from these styles.
		cvTexts.forEach(({ items, styles }) => {
			joinAccents(items);
			Object.values(styles).forEach((style) => { style.fontFamily = cvFont; });
		});
		status.textContent = '';
		box.replaceChildren(status, ...cvPages.map((_, i) => {
			// The wrapper carries the shadow, so nothing composites the canvas itself.
			const sheet = document.createElement('div');
			sheet.className = 'cv-pages__sheet';
			sheet.setAttribute('role', 'group');
			sheet.setAttribute('aria-label', `CV page ${i + 1} of ${pdf.numPages}`);
			sheet.appendChild(document.createElement('canvas')).setAttribute('aria-hidden', 'true');
			sheet.appendChild(document.createElement('div')).className = 'textLayer';
			return sheet;
		}));
		zoomBar.hidden = false;
		window.addEventListener('resize', scheduleDraw);
		watchPixelRatio();
		// TextLayer measures with the body font, so it must be loaded first.
		await document.fonts.ready;
		await drawPages();
	} catch {
		showFallback();
	}
}

// Shows one tab's pane and marks its nav link; the build renders the same state into each page.
function showPane(id) {
	document.querySelector('.not-found')?.remove();
	panes.forEach((pane) => { pane.hidden = pane.id !== id; });
	links.forEach((link) => {
		const isActive = tabForPath(link.pathname) === id;
		link.parentNode.classList.toggle('active', isActive);
		if (isActive) {
			link.setAttribute('aria-current', 'page');
			document.title = link.dataset.title;
		} else {
			link.removeAttribute('aria-current');
		}
	});
	if (id === 'cv' && !cvRequested) {
		cvRequested = true;
		renderCv();
	} else if (id === 'cv' && cvPages.length > 0) {
		// The window may have been resized while another tab was showing.
		scheduleDraw();
	}
}

// Real URLs per tab, switched in place with pushState so Cloudflare's beacon counts each tab as a pageview.
document.querySelector('nav').addEventListener('click', (event) => {
	const link = event.target.closest('a');
	// Leave new-tab/window clicks and targeted links to the browser.
	if (!link || link.target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	event.preventDefault();
	if (link.pathname === location.pathname) return;
	// Remember where this entry was scrolled, for Back.
	history.replaceState({ scrollY }, '');
	history.pushState(null, '', link.pathname);
	showPane(tabForPath(link.pathname));
	scrollTo(0, 0);
});

window.addEventListener('popstate', (event) => {
	const id = tabForPath(location.pathname);
	if (!id) return;
	showPane(id);
	// A fragment link (#something) also fires popstate; leave its jump to the browser.
	if (!location.hash) scrollTo(0, event.state?.scrollY ?? 0);
});

// Old #about/#research/#cv links move to their path; any other hash is left alone.
function followHash() {
	const path = pathForHash(location.hash);
	if (!path) return false;
	history.replaceState(null, '', path);
	showPane(tabForPath(path));
	// The browser jumped to the pane with that id; the tab starts at the top instead.
	scrollTo(0, 0);
	return true;
}

window.addEventListener('hashchange', followHash);
// The 404 page's path matches no tab; it keeps the About pane it was built with.
const initial = tabForPath(location.pathname);
if (!followHash() && initial) showPane(initial);
