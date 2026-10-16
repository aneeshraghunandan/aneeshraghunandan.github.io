// The site's tabs and their URLs, shared by the build (template.mjs) and the browser (script.js).

export const TABS = [
	{ id: 'about', path: '/', label: 'About' },
	{ id: 'research', path: '/research/', label: 'Research' },
	{ id: 'cv', path: '/cv/', label: 'CV' },
];

/** Returns the tab id for a URL path ("/cv/", "/cv", "/cv/index.html"), or null for any other path. */
export function tabForPath(pathname) {
	const path = pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
	return TABS.find((tab) => tab.path === path)?.id ?? null;
}

/** Maps an old "#cv"-style link to its path, or null for any other hash. */
export function pathForHash(hash) {
	return TABS.find((tab) => `#${tab.id}` === hash)?.path ?? null;
}

/** The document title for a tab: About is the plain name. */
export function tabTitle(id, name) {
	const tab = TABS.find((t) => t.id === id);
	return id === 'about' ? name : `${tab.label} · ${name}`;
}
