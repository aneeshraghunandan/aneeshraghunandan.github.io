// How the CV's PDF fonts show in the site's body font, shared by the build (its warning) and the browser (script.js).

// LaTeX's Computer Modern names (CMBX12, CMTI10, ...) are matched by prefix; other fonts by words in their name.
const FACES = [
	['fontWeight', 'bold', /^CMB|^CMSSBX|[Bb]old|[Bb]lack|[Hh]eavy|[Dd]emi/],
	['fontStyle', 'italic', /^CM(TI|MI|SL|BXTI|BXSL|SSI)|[Ii]talic|[Oo]blique|[a-z-]It(MT)?$/],
	['fontVariant', 'small-caps', /^CMCSC|[Ss]mall ?[Cc]aps|[-_]SC\d*$/],
];

/** Strips a PDF subset tag ("SXGZPZ+CMBX12" -> "CMBX12"). */
export function baseFontName(name) {
	return (name ?? '').replace(/^[A-Z]{6}\+/, '');
}

/** The CSS style properties for a PDF font name, e.g. { fontWeight: 'bold' }; {} for a regular face. */
export function cvFace(name) {
	const base = baseFontName(name);
	return Object.fromEntries(FACES.filter(([, , pattern]) => pattern.test(base)).map(([property, value]) => [property, value]));
}

/** True for LaTeX's Computer Modern fonts, the ones the CV viewer was tuned on. */
export function isComputerModern(name) {
	return /^CM[A-Z]+\d*$/.test(baseFontName(name));
}
