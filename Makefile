# Everything the project can do. `make site` is what CI runs on every push.
TEXINPUTS := books/common:

PY := $(shell [ -x .venv/bin/python3 ] && echo .venv/bin/python3 || echo python3)

site:                 ## LaTeX -> out/  (needs latexml + ./run.sh deps)
	$(PY) site/build.py

pdf:                  ## both books as PDF, same sources
	cd MMP___Precise_theory && TEXINPUTS=../books/common: latexmk -pdf main.tex
	cd 'books/MMP___For_contestants (1)' && TEXINPUTS=../common: latexmk -pdf main.tex
	cd 'books/MMP___For_contestants (1)' && TEXINPUTS=../common: latexmk -pdf main.tex  # resolve references

test:                 ## check the degree engine against the worked examples
	node site/static/mmp/test.mjs

figure:               ## regenerate static figures from the constructions
	@for f in applets/*.mmp; do \
		n=$$(basename $$f .mmp); node tools/figure.mjs $$f figs/$$n.svg; \
	done

demo:                 ## serve the standalone applet demo on :8000
	@cd site/static && python3 -m http.server 8000

check: test           ## also verify every construction in applets/ runs and its claim holds
	node site/static/mmp/verify.mjs applets/*.mmp

serve: site           ## preview at http://localhost:8000
	python3 -m http.server 8000 --directory out

deps:                 ## project-local .venv with the two Python packages
	./run.sh deps

clean:
	rm -rf out build

.PHONY: site pdf test check figure demo serve deps clean
