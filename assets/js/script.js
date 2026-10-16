const panes = Array.from(document.querySelectorAll('#content > div'));
const links = Array.from(document.querySelectorAll('nav a'));

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
}

window.addEventListener('hashchange', showPane);
showPane();
