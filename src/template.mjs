// Renders index.html from validated site.json content. Fields ending in _html are trusted inline HTML; everything else is escaped.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const esc = escapeHtml;

function renderNotes(items) {
	if (items.length === 0) return '';
	return `\n\t\t\t\t\t\t\t<ul>\n${items.map((item) => `\t\t\t\t\t\t\t\t<li>${item}</li>`).join('\n')}\n\t\t\t\t\t\t\t</ul>`;
}

function renderTitle(paper) {
	const title = paper.url ? `<a href="${esc(paper.url)}" target="_blank">${esc(paper.title)}</a>` : esc(paper.title);
	return paper.coauthors ? `${title} <small>(with ${esc(paper.coauthors)})</small>` : title;
}

function renderPublication(paper) {
	const citation = paper.status
		? `${esc(paper.status)}, <i>${esc(paper.venue)}</i>`
		: `<i>${esc(paper.venue)}</i> ${esc(paper.volume)}, ${esc(paper.year)}`;
	return `\t\t\t\t\t\t\t<h2 class="article-header">${renderTitle(paper)}<br>
\t\t\t\t\t\t\t<small>${citation}</small></h2>${renderNotes(paper.notes_html ?? [])}`;
}

function renderWorkingPaper(paper) {
	const status = paper.status ? [`${esc(paper.status)}, <i>${esc(paper.venue)}</i>`] : [];
	return `\t\t\t\t\t\t\t<h2 class="article-header">${renderTitle(paper)}</h2>${renderNotes([...status, ...(paper.notes_html ?? [])])}`;
}

function renderAbout(site) {
	const [user, domain] = site.email.split('@');
	return `\t\t\t\t\t<div id="about">
\t\t\t\t\t\t<div class="picture-and-label">
\t\t\t\t\t\t\t<div class="picture-not-label"><img src="${esc(site.photo)}" width="360" height="360" alt="${esc(site.name.first)} Profile Picture"></div>
\t\t\t\t\t\t\t<div class="label-not-picture">
\t\t\t\t\t\t\t\t<h1><span>${esc(site.name.first)}</span> ${esc(site.name.last)}</h1>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<h1>Contact</h1>
\t\t\t\t\t\t<div class="clearfix contact-info">
\t\t\t\t\t\t\t<div class="label">E-mail:</div>
\t\t\t\t\t\t\t<div class="info"><a href="mailto:${esc(site.email)}">${esc(user)}@<wbr>${esc(domain)}</a></div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="clearfix contact-info">
\t\t\t\t\t\t\t<div class="label">Address:</div>
\t\t\t\t\t\t\t<div class="info">${site.address.map(esc).join('<br>\n\t\t\t\t\t\t\t\t')}</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<hr>
\t\t\t\t\t\t<h1>About me</h1>
${site.about_html.map((html) => `\t\t\t\t\t\t<p>${html}</p>`).join('\n')}
\t\t\t\t\t</div>`;
}

function renderResearch(site) {
	return `\t\t\t\t\t<div id="research">
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<h1>Interests</h1>
\t\t\t\t\t\t\t<p>${esc(site.interests)}</p>
\t\t\t\t\t\t\t<hr>
\t\t\t\t\t\t\t<h1>Publications</h1>
${site.publications.map(renderPublication).join('\n')}
\t\t\t\t\t\t\t<h1>Working papers</h1>
${site.working_papers.map(renderWorkingPaper).join('\n')}
\t\t\t\t\t\t\t<hr>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>`;
}

// "2026-08" -> "August 2026".
function monthYear(updated) {
	const [year, month] = updated.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function renderCv(site, cvUrl) {
	const pdf = esc(cvUrl);
	const downloadName = esc(cvUrl.split('/').pop().replace(/\.pdf$/, `_${site.cv.updated}.pdf`));
	return `\t\t\t\t\t<div id="cv">
\t\t\t\t\t\t<div class="cv-card">
\t\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t\t<h1>Curriculum Vitae</h1>
\t\t\t\t\t\t\t\t<p>Updated ${esc(monthYear(site.cv.updated))}</p>
\t\t\t\t\t\t\t\t<p>PDF. Open it in a new tab or save a copy.</p>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div class="cv-card__actions">
\t\t\t\t\t\t\t\t<a class="button" href="${pdf}" target="_blank" rel="noopener">View</a>
\t\t\t\t\t\t\t\t<a class="button" href="${pdf}" download="${downloadName}">Download</a>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="cv-viewer">
\t\t\t\t\t\t\t<!-- script.js shows the zoom bar once the PDF loads. -->
\t\t\t\t\t\t\t<div class="cv-zoom" id="cv-zoom" role="group" aria-label="CV zoom" hidden>
\t\t\t\t\t\t\t\t<button type="button" class="button cv-zoom__button" data-zoom="-1" aria-label="Zoom out">&minus;</button>
\t\t\t\t\t\t\t\t<button type="button" class="button cv-zoom__button" data-zoom="0" aria-label="Fit to width">Fit</button>
\t\t\t\t\t\t\t\t<button type="button" class="button cv-zoom__button" data-zoom="1" aria-label="Zoom in">+</button>
\t\t\t\t\t\t\t\t<span class="cv-zoom__level" aria-live="polite">100%</span>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<!-- script.js renders the PDF pages here with PDF.js the first time this tab opens. -->
\t\t\t\t\t\t\t<div class="cv-pages" id="cv-pages" data-pdf="${pdf}" data-download="${downloadName}">
\t\t\t\t\t\t\t\t<p class="cv-pages__status">Loading CV pages...</p>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>`;
}

/** Returns the full index.html. `assets` holds the css/js/favicon/cv URLs. */
export function renderPage(site, assets) {
	const fullName = esc(`${site.name.first} ${site.name.last}`);
	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>${fullName}</title>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta name="description" content="${fullName} Profile Page">
		<meta name="author" content="${fullName}">
		<link rel="shortcut icon" href="${esc(assets.favicon)}">
		<link rel="stylesheet" href="${esc(assets.css)}">
		<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "fee90e9283e944498cf8e6d19bdf5bcc"}'></script><!-- End Cloudflare Web Analytics -->
	</head>
	<body class="gray pattern-1">
		<div id="siteContainer">
			<header class="clearfix">
				<nav>
					<ul class="clearfix">
						<li><a href="#about">About</a></li>
						<li><a href="#research">Research</a></li>
						<li><a href="#cv">CV</a></li>
					</ul>
				</nav>
			</header>
			<div id="container">
				<div id="content">
${renderAbout(site)}
${renderResearch(site)}
${renderCv(site, assets.cv)}
				</div>
			</div>
			<footer>
			</footer>
		</div>
		<script src="${esc(assets.js)}"></script>
	</body>
</html>
`;
}
