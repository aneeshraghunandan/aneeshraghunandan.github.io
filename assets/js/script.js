const panes = Array.from(document.querySelectorAll('#content > div'));
const links = Array.from(document.querySelectorAll('nav a'));
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149';
let cvRequested = false;

// Loads PDF.js only when the CV tab first opens, then draws every page of the CV.
async function renderCv() {
	const box = document.getElementById('cv-pages');
	try {
		const pdfjs = await import(`${PDFJS}/pdf.min.mjs`);
		pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
		const pdf = await pdfjs.getDocument('assets/cv.pdf').promise;
		// Sized for the column at render time; wider later resizes are CSS-scaled.
		const cssWidth = Math.min(800, box.clientWidth);
		box.replaceChildren();
		for (let n = 1; n <= pdf.numPages; n++) {
			const page = await pdf.getPage(n);
			const scale = (cssWidth * devicePixelRatio) / page.getViewport({ scale: 1 }).width;
			const viewport = page.getViewport({ scale });
			const canvas = document.createElement('canvas');
			canvas.width = Math.floor(viewport.width);
			canvas.height = Math.floor(viewport.height);
			canvas.setAttribute('role', 'img');
			canvas.setAttribute('aria-label', `CV page ${n} of ${pdf.numPages}`);
			box.append(canvas);
			await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
		}
	} catch {
		box.innerHTML = '<p>The CV pages could not be shown here. <a href="assets/cv.pdf" target="_blank" rel="noopener">View the PDF</a> or <a href="assets/cv.pdf" download>download it</a>.</p>';
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
	}
}

window.addEventListener('hashchange', showPane);
showPane();
