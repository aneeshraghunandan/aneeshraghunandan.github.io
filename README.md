# aneeshraghunandan.com

Source for www.aneeshraghunandan.com. There are three things to update: the page
text (`content/site.json`), the CV PDF (`content/cv.pdf`) and the photo
(`content/photo.jpg`). Each is a single file in `content/`; edit or replace it on
GitHub and commit to `master`.

> **One-time setup after this change is merged:** the repo owner must open
> **Settings > Pages > Build and deployment > Source** and choose **GitHub Actions**.
> Until then GitHub keeps serving the repository files as they are, and the live
> site will have no `index.html`.

## Updating the text

All page text lives in `content/site.json`. Edit it on GitHub (open the file, click
the pencil icon, then "Commit changes"). Each commit to `master` rebuilds and
publishes the site through `.github/workflows/pages.yml`; the Actions tab shows
progress and any error.

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
| `volume`, `year` | publications without `status` | `"100(1)"`, `"2025"` |
| `notes_html` | no | `["Best Paper Award, 2020 RAST Conference"]` |

A publication shows "status, *venue*" when it has a `status`, otherwise
"*venue* volume, year". A working paper with `status` and `venue` shows them as
its first bullet.

If a field is missing or misspelled, the build stops and the Actions log names it,
for example `content/site.json: publications[2].title must be a non-empty text value`.
The live site keeps the previous version until the error is fixed.

## Updating the CV (PDF)

1. On GitHub, open `content/`, choose "Add file > Upload files" and upload the new
   PDF named `cv.pdf` so it replaces the old one.
2. In `content/site.json`, set `cv.updated` to the year and month, e.g. `"2026-08"`.

The site always serves the CV at `/Aneesh_Raghunandan_CV.pdf`, so links to it keep
working. `updated` sets the "Updated August 2026" line on the CV tab and the
downloaded file name (`Aneesh_Raghunandan_CV_2026-08.pdf`).

## Changing the photo

On GitHub, open `content/`, choose "Add file > Upload files" and upload the new
photo named `photo.jpg` so it replaces the old one. A square image at
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
