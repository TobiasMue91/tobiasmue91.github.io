#!/bin/bash
# Step 1 of the Describing Words data (tools/descriptocraft.html): stream the 99 "arcs" files of
# Google Books' English syntactic n-grams (2013 release, ~35 GB) and keep every adjective-noun
# pair (amod, JJ -> NN/NNS) with its count from 1900 on. About 30 minutes on a fast line.
#
#   util/describing_words/fetch.sh <outdir>       # writes <outdir>/0.tsv .. 98.tsv
#   python util/describing_words/build.py <outdir> # step 2
set -o pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${1:?usage: fetch.sh <outdir>}
mkdir -p "$out"
one() {
  i=$1; f=$(printf "arcs.%02d-of-99.gz" "$i")
  [ -e "$out/$i.tsv" ] && return 0
  for try in 1 2 3; do
    curl -s --fail "https://storage.googleapis.com/books/syntactic-ngrams/eng/$f" | zcat \
      | LC_ALL=C grep -F '/amod/' | python3 "$here/amod.py" > "$out/$i.tmp" \
      && mv "$out/$i.tmp" "$out/$i.tsv" && return 0
    sleep 5
  done
  echo "failed: $f" >&2
}
export -f one; export out here
seq 0 98 | xargs -P 4 -I{} bash -c 'one {}'
