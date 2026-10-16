const panes = Array.from(document.querySelectorAll('#content > div'));
const links = Array.from(document.querySelectorAll('nav a'));
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149';
// Zoom is a multiple of the fit width, where each page fills the viewer.
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const box = document.getElementById('cv-pages');
const zoomBar = document.getElementById('cv-zoom');
const zoomOut = zoomBar.querySelector('[data-zoom="-1"]');
const zoomIn = zoomBar.querySelector('[data-zoom="1"]');
const zoomLevel = zoomBar.querySelector('.cv-zoom__level');
let cvRequested = false;
let cvPages = [];
let zoom = 1;
let drawnSize = '';
let drawId = 0;
let renderTask = null;
let drawTimer = 0;

function showFallback() {
	zoomBar.hidden = true;
	const { pdf, download } = box.dataset;
	// pdf and download come from the build (fixed path and a validated date), not from visitors.
	box.innerHTML = `<p>The CV pages could not be shown here. <a href="${pdf}" target="_blank" rel="noopener">View the PDF</a> or <a href="${pdf}" download="${download}">download it</a>.</p>`;
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
	const sizes = cvPages.map((page) => {
		const base = page.getViewport({ scale: 1 });
		return { base, height: Math.round((width * base.height) / base.width) };
	});
	const canvases = Array.from(box.querySelectorAll('canvas'));
	sizes.forEach(({ height }, i) => Object.assign(canvases[i].style, { width: `${width}px`, height: `${height}px` }));
	if (anchor) restoreScroll(anchor);
	for (const [i, page] of cvPages.entries()) {
		// A fresh canvas per draw: PDF.js refuses a canvas whose cancelled render has not settled yet.
		const canvas = canvases[i].cloneNode();
		canvas.width = Math.round(width * devicePixelRatio);
		canvas.height = Math.round(sizes[i].height * devicePixelRatio);
		const viewport = page.getViewport({ scale: canvas.width / sizes[i].base.width });
		renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
		try {
			await renderTask.promise;
		} catch (error) {
			if (error?.name === 'RenderingCancelledException') return;
			throw error;
		}
		if (id !== drawId) return;
		canvases[i].replaceWith(canvas);
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
	try {
		const pdfjs = await import(`${PDFJS}/pdf.min.mjs`);
		pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
		const pdf = await pdfjs.getDocument(box.dataset.pdf).promise;
		cvPages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1)));
		box.replaceChildren(...cvPages.map((_, i) => {
			// The wrapper carries the shadow, so nothing composites the canvas itself.
			const sheet = document.createElement('div');
			sheet.className = 'cv-pages__sheet';
			const canvas = sheet.appendChild(document.createElement('canvas'));
			canvas.setAttribute('role', 'img');
			canvas.setAttribute('aria-label', `CV page ${i + 1} of ${pdf.numPages}`);
			return sheet;
		}));
		zoomBar.hidden = false;
		window.addEventListener('resize', scheduleDraw);
		watchPixelRatio();
		await drawPages();
	} catch {
		showFallback();
	}
}

function showPane() {
	let id = location.hash.slice(1);
	// Unknown or malformed hashes fall back to About instead of blanking the page.
	if (!panes.some((pane) => pane.id === id)) id = 'about';
	panes.forEach((pane) => { pane.style.display = pane.id === id ? '' : 'none'; });
	links.forEach((link) => {
		const isActive = link.getAttribute('href') === `#${id}`;
		link.parentNode.classList.toggle('active', isActive);
		if (isActive) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	});
	if (id === 'cv' && !cvRequested) {
		cvRequested = true;
		renderCv();
	} else if (id === 'cv' && cvPages.length > 0) {
		// The window may have been resized while another tab was showing.
		scheduleDraw();
	}
}

window.addEventListener('hashchange', showPane);
showPane();
