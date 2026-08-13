# The Method of Moving Points — website

Two books, one LaTeX source each, one static site. The author's entire interface
is: edit a `.tex` file, optionally drop a figure and a construction next to it,
push. CI does the rest.

```
books/
  common/mmp.sty            shared macros — theorem envs, \rref, \mmpfig
  MMP___For_contestants (1)/
    main.tex                the real contestant manuscript and chapter order
    kepek/                  figures used by the manuscript
  rigorous/
    main.tex
    sec/...
figs/gergonne.svg           static figure for the construction demo
applets/gergonne.mmp        optional: same name -> the figure becomes interactive
applets/foo.geogebra        optional: a GeoGebra material id, embedded as-is
site/
  build.py                  LaTeXML output -> pages
  templates/page.html
  static/style.css split.js
  static/mmp/               poly.js engine.js applet.js  (the degree calculator)
out/                        generated; never edited, never committed
```

## The five conventions

Everything else follows from these.

| thing | where it lives | why |
|---|---|---|
| chapter order | the `\section` list in the contestant `main.tex` | reordering one list keeps the PDF and site aligned |
| page URL | `\label{sec:foo}` on the section | survives reordering and renumbering — permalinks never rot |
| numbering | LaTeX counters | never typed by hand, so it cannot disagree with the PDF |
| cross-book link | `\rref{thm:zack}` | one macro, resolved to a number in the PDF and to a split-pane link on the site |
| interactive figure | `applets/<figure name>.mmp` | no markup change: add the file, the figure upgrades itself |

## Pipeline

```
main.tex ──latexml──► book.xml ──latexmlpost──► one HTML fragment per section
                                                        │
                            build.py ◄───────────────────┘
                              ├ our shell, nav, pager
                              ├ rref: → /rigorous/<slug>/#<anchor> + data-book
                              ├ <img src=figs/foo> + applets/foo.mmp → applet
                              └ out/  +  search.json  +  labels.json
```

LaTeXML is used because it understands `\newtheorem`, resolves `\label`/`\ref`
itself, and emits structured XML rather than a soup of divs — so `build.py`
stays small. Nobody has to install it: CI does, and `make serve` previews
locally for anyone who wants to.

Math ships as MathML (no runtime JS). If a browser's rendering is not good
enough, `latexmlpost --mathtex` also keeps the TeX source in the output, and a
build-time KaTeX pass can be dropped in without touching anything else.

## Split view

Every page is an ordinary standalone page. `split.js` intercepts clicks on
links carrying `data-book="rigorous"` when the window is wide enough, fetches
the target, and puts its `<main>` in the right-hand pane. No JS, a phone, or a
middle-click all just follow the link. The current pair is in the URL as
`?beside=`, so a split view can be sent to someone.

## The degree calculator

Every construction step in the method is a polynomial map on homogeneous
coordinates — join and meet are cross products, pole-polar is a matrix times a
vector, midpoints and perpendicular directions are small rational expressions.
So a construction is written once, against an abstract ring, and run twice:

* over **F_p[t]**, with `t` the indeterminate → exact degrees;
* over **R**, with `t` a number → the coordinates the picture draws.

The degree rule is one line: after each step, divide the three coordinates by
their gcd and take the max degree of what survives. The drop

```
#(coincidence) = naive degree − actual degree
```

is exactly the correction term in Zack's lemma. Finite coincidences appear as
the gcd; coincidences at t = ∞ appear as cancellation of leading coefficients;
taking the max degree after gcd-division catches both. Nothing is counted by
hand and nothing is annotated per problem.

`p` is 998244353, chosen ≡ 1 (mod 4) so that i = √−1 lives in the field — the
circle points (1 : ±i : 0) have to be real inhabitants or the method collapses.
Fixed points are given as exact rationals, so a run is exact; a different
choice of fixed points is a second, independent check.

### The construction language

One object per line, in construction order. Comments become the prose shown
next to each step.

```
E  = circle 3          # tangency point on CA, fixed
F  = circle -2
D  = circle $t         # the animated point, degree 2 on the incircle
AB = polar F           # side AB is the polar of F
BC = polar D
B  = meet AB BC
BE = join B E
claim concurrent AD BE CF
```

Current steps: `free x y`, `circle s`, `on P Q s`, `join`, `meet`, `polar`,
`midpoint`, `dir`, `perpdir`, `perpline P l`, `perpbis A B`, `anglebis A B C`,
`claim collinear|concurrent`. Adding one is a few lines in `engine.js` — the
only requirement for degree tracking is that it be polynomial in the
coordinates. `anglebis` is real-coordinate only, so its degree is unavailable.

`make check` runs every construction in `applets/` in CI and fails the build if
a claim stops holding. The figures on the site are machine-checked mod p.

### Three tiers of figure, always

1. **an image** — `figs/foo.png`, what the PDF shows, always the fallback;
2. **a GeoGebra embed** — `applets/foo.geogebra` holding a material id, for
   anything the DSL can't express yet;
3. **a construction** — `applets/foo.mmp`, which gets the movable figure, the
   degree worksheet, and the CI check.

Nothing is ever blocked on tier 3.

## Start here

```
./run.sh              check the environment, run the tests, open the demo
./run.sh doctor       just report what's installed
./run.sh test         engine tests and construction checks, nothing else
./run.sh open         serve the prebuilt site in out/ — no toolchain needed
./run.sh deps         create .venv and install the two Python packages
./run.sh site         rebuild from LaTeX and serve it (needs latexml)
```

`./run.sh` with no arguments is the whole first pass: it tells you what's
missing, runs the degree engine against the worked examples from the notes,
re-runs every construction in `applets/`, then serves
`site/static/mmp/demo.html` and opens it. That page has two live figures and
needs no LaTeX toolchain at all.

## Commands

```
make site      build out/
make demo      serve the standalone applet demo on :8000
make serve     build the site and preview it on :8000
make pdf       both books as PDF from the same sources
make test      the engine against the worked examples in the notes
make check     every published construction, and its claim
make figure    regenerate figs/*.svg from applets/*.mmp
```

## Environment

Three tools, and only the first is needed for the tests and the demo:

* **node 18+** — used as a script runner, never as a package manager. There is
  no `node_modules`, no lockfile, no bundler. What you read in
  `site/static/mmp/` is byte-for-byte what runs in the browser.
* **python 3.9+** with `jinja2` and `lxml` — needed only by `build.py`.
  Everything else it uses is standard library. `./run.sh deps` puts them in a
  project-local `.venv`; nothing is installed system-wide, and deleting
  `.venv/` undoes all of it. Do not `pip3 install` into Homebrew Python — it
  refuses (PEP 668), correctly.
* **latexml** — `brew install latexml`. A Perl program, not a Python package,
  and only needed for the LaTeX → HTML step.

Optional: `latexmk` for `make pdf`.

## What has and hasn't run

`build.py` runs end to end against LaTeXML 0.8.8 and produces 21 contestant
chapters plus the rigorous book, references, 1,900 labels, 29 manuscript
figures, working cross-book links, and the existing figure applet. Also tested:
`poly.js`, `engine.js`, `test.mjs`, `verify.mjs`, `tools/figure.mjs`, `run.sh`,
and the generated contestant URLs.

Still unverified: how it all *looks*. `applet.js`, `split.js`, the CSS and the
page template have been checked structurally but never rendered in a browser.
The CI workflow has never run.

The contestant site is sourced from `books/MMP___For_contestants (1)/main.tex`.
Its original `kod.sty` remains beside the manuscript for reference; the site
uses the project's smaller `mmp.sty` compatibility layer so LaTeXML can build
the same text and figures.

`out/` is normally generated and gitignored; it is included here only so the
site can be looked at without installing latexml.
