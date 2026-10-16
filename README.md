# Editing the site

There are three things to update: the page text ([`content/site.json`](content/site.json)),
the CV ([`content/cv.pdf`](content/cv.pdf)) and the photo ([`content/photo.jpg`](content/photo.jpg)).
Each commit to `master` rebuilds and publishes the site through
[`pages.yml`](.github/workflows/pages.yml); the [Actions tab](../../actions) shows progress and any error.

## Updating the text

All page text lives in [`content/site.json`](content/site.json).

### site.json rules

- Text goes in "double quotes". Separate items in a list `[...]` with commas, and no
  comma after the last item.
- Fields whose name ends in `_html` (`about_html`, `notes_html`) may contain simple
  inline HTML such as `<i>...</i>` or `<a href="https://...">...</a>`. Write a `"`
  inside them as `\"`. Every other field is plain text and shows exactly as typed.
- `publications` and `working_papers` are shown in the order listed. Each paper has:

| Field | Required | Example |
| --- | --- | --- |
| `title` | yes | `"Two-Sided Matching in the Audit Market"` |
| `url` | no (title is not linked without it) | `"https://..."` |
| `coauthors` | no | `"Ken Li and Maureen McNichols"` (shown as "(with ...)") |
| `venue` | publications: yes | `"The Accounting Review"` (shown in italics) |
| `status` | no | `"Forthcoming"`, `"Revise and Resubmit"` |
| `volume`, `year` | publications without `status` (never on working papers) | `"100(1)"`, `"2025"` |
| `notes_html` | no | `["Best Paper Award, 2020 RAST Conference"]` |

A publication shows "status, *venue*" when it has a `status`, otherwise
"*venue* volume, year". A working paper with `status` and `venue` shows them as
its first bullet. The page adds the commas, so `venue`, `volume`, `year` and
`status` must not end in `.`, `,`, `;` or `:`.

If a field is missing or misspelled, the build stops and the Actions log names it,
for example `content/site.json: publications[2].title must be a non-empty text value`.
The live site keeps the previous version until the error is fixed.

## Updating the CV (PDF)

Replace [`content/cv.pdf`](content/cv.pdf) with the new PDF, keeping the file name.

The "Updated" month comes from the date stored inside the PDF: its modification
date, or its creation date if it has none. LaTeX, Word and most PDF exporters set
this when the file is made. The build only reads a date written as plain text in
the PDF; if the file keeps its date only in compressed or XMP metadata (some
online converters and PDF editors do this), the build stops and the Actions log
asks for `cv.updated`. If the month shown is wrong, or the build fails because the
PDF has no readable date, override it in [`content/site.json`](content/site.json):

```json
"cv": { "file": "content/cv.pdf", "updated": "2026-08" }
```

An override wins over every later PDF until it is removed, so delete `updated`
again with the next CV upload.

The CV tab draws the PDF's pages in the browser and shows its text in the site's
font, picking bold, italic and small caps from each font's name. It was built for
LaTeX CVs (Computer Modern fonts). A CV made another way still works, but the build
then shows a warning in the Actions log naming each font and how it will look; open
the CV tab after the deploy and check it.

The site always serves the CV at `/Aneesh_Raghunandan_CV.pdf`, so links to it keep
working. The month sets the "Updated August 2026" line on the CV tab and the
downloaded file name (`Aneesh_Raghunandan_CV_2026-08.pdf`).

## Changing the photo

Replace [`content/photo.jpg`](content/photo.jpg) with the new photo, keeping the file name. A square image at
least 360 pixels wide works best; the build makes the smaller sizes.

## Building locally

Needs Node 22 or newer. `npm ci` once, then `npm start` builds into `_site/` and
serves it at http://localhost:8000. `npm run build` only builds; `npm test` checks
the content rules.

## What gets published

Only the build output in `_site/` is deployed: the rendered pages, the files listed
in `STATIC_FILES` in `build.mjs`, the resized photo and the CV. Nothing else in the
repository (`content/site.json`, `.git`, config files, any `.env`) is served. Do not
put secrets in `assets/img/`, since that folder is copied as is.
