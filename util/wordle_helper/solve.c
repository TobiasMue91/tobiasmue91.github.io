/* Exact optimal Wordle decision tree for a fixed opener (normal mode), for util/wordle_helper/build.py.

     cc -O2 -o solve solve.c && ./solve guesses.txt answers.txt salet WORKERS ID [cost]

   Cost of a candidate set S is the total number of guesses needed to solve every answer in S, counting
   the guess that turns up five greens:

     f({a}) = 1,   f(S) = |S| + min over guesses g of  sum over feedback p != GGGGG of f(S split by g into p)

   Exact depth-first branch and bound, memoised on the candidate set:
   - f(S) >= 2|S| - 1 for |S| >= 2 (one word can be guessed first, every other needs two guesses), and
     that bound is met exactly when a word of S tells all the others apart - checked first, it is cheap.
   - Each guess gets the lower bound |S| + sum of (2k - 1) over its groups of size k; guesses are tried in
     order of that bound and the search stops at the first one that cannot beat the best found.
   - Groups are solved largest first with the budget that is left, so a guess is dropped as soon as it
     provably loses (a fail-high stores a lower bound in the memo, a full solve stores the exact cost).

   Worker ID of WORKERS takes every WORKERS-th group of the opener (largest first) and prints its subtree,
   one line per node, "<pattern>,<pattern>,...<TAB><guess>", patterns being the feedback that led there
   (index sum of colour * 3^position, grey 0, yellow 1, green 2; 242 is five greens). It also prints
   "#cost <pattern> <f>" per group and "#fit <n> <sum f> <count>" over every exactly solved set, which
   build.py uses to fit the page's estimate of f for sets it cannot solve exactly. With "cost" it prints
   only the "#cost" lines, for openers whose tree is not kept. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#define NP 243
#define WIN 242
#define INF 1000000

static int G, A;
static char (*W)[6];
static uint8_t *P;          /* P[g * A + a]: feedback of guess g on answer a */
static int *ansGuess;       /* answer a -> its guess index */
static int *guessAns;       /* guess g -> answer index, or -1 */

/* ---------- memo: open addressing on a 64-bit hash, sets kept for an exact comparison ---------- */
typedef struct { uint64_t h; uint32_t off; uint16_t n; uint8_t exact; int32_t val; int32_t best; } Entry;
static Entry *tab; static uint64_t tabCap, tabUsed;
static uint16_t *arena; static uint64_t arenaCap, arenaUsed;

static uint64_t hashSet(const uint16_t *s, int n) {
  uint64_t h = 0x9E3779B97F4A7C15ull ^ (uint64_t)n;
  for (int i = 0; i < n; i++) { h ^= s[i] + 0x9E3779B97F4A7C15ull + (h << 6) + (h >> 2); h *= 0xBF58476D1CE4E5B9ull; h ^= h >> 31; }
  return h ? h : 1;
}
static Entry *find(const uint16_t *s, int n, uint64_t h) {
  uint64_t i = h & (tabCap - 1);
  for (;;) {
    Entry *e = &tab[i];
    if (!e->h) return e;
    if (e->h == h && e->n == n && !memcmp(arena + e->off, s, n * sizeof(uint16_t))) return e;
    i = (i + 1) & (tabCap - 1);
  }
}
static void grow(void);
static void store(const uint16_t *s, int n, int val, int exact, int best) {
  uint64_t h = hashSet(s, n);
  Entry *e = find(s, n, h);
  if (e->h) {
    if (e->exact) return;
    if (exact || val > e->val) { e->val = val; e->exact = exact; e->best = best; }
    return;
  }
  if (arenaUsed + n > arenaCap) { arenaCap *= 2; arena = realloc(arena, arenaCap * sizeof(uint16_t)); if (!arena) { fprintf(stderr, "out of memory\n"); exit(1); } }
  memcpy(arena + arenaUsed, s, n * sizeof(uint16_t));
  e->h = h; e->off = (uint32_t)arenaUsed; e->n = (uint16_t)n; e->exact = (uint8_t)exact; e->val = val; e->best = best;
  arenaUsed += n;
  if (++tabUsed * 2 > tabCap) grow();
}
static void grow(void) {
  Entry *old = tab; uint64_t oldCap = tabCap;
  tabCap *= 2; tab = calloc(tabCap, sizeof(Entry)); if (!tab) { fprintf(stderr, "out of memory\n"); exit(1); }
  for (uint64_t i = 0; i < oldCap; i++) if (old[i].h) {
    uint64_t j = old[i].h & (tabCap - 1);
    while (tab[j].h) j = (j + 1) & (tabCap - 1);
    tab[j] = old[i];
  }
  free(old);
}

/* ---------- search ---------- */
typedef struct { int lb; int g; int inS; int sq; } Cand;
static int cmpCand(const void *x, const void *y) {
  const Cand *a = x, *b = y;
  if (a->lb != b->lb) return a->lb - b->lb;
  if (a->inS != b->inS) return b->inS - a->inS;
  if (a->sq != b->sq) return a->sq - b->sq;
  return a->g - b->g;
}
static inline int lbPart(int k) { return k == 1 ? 1 : 2 * k - 1; }

static long long nodes;

/* Splits S by guess g into parts written to out (grouped by pattern, each group in S's order);
   pat[], start[], size[] describe the groups. Returns the number of non-winning groups. */
static int split(const uint16_t *S, int n, int g, uint16_t *out, int *pats, int *starts, int *sizes) {
  int cnt[NP] = {0}, pos[NP];
  const uint8_t *row = P + (size_t)g * A;
  for (int i = 0; i < n; i++) cnt[row[S[i]]]++;
  int k = 0, at = 0;
  for (int p = 0; p < NP; p++) if (cnt[p] && p != WIN) { pats[k] = p; starts[k] = at; sizes[k] = cnt[p]; pos[p] = at; at += cnt[p]; k++; }
  for (int i = 0; i < n; i++) { int p = row[S[i]]; if (p != WIN) out[pos[p]++] = S[i]; }
  return k;
}

/* Exact f(S) if it is below beta; otherwise some value >= beta. */
static int solve(const uint16_t *S, int n, int beta) {
  if (n == 1) return 1;
  if (n == 2) return 3;
  uint64_t h = hashSet(S, n);
  Entry *e = find(S, n, h);
  if (e->h) { if (e->exact || e->val >= beta) return e->val; }
  nodes++;
  if (2 * n - 1 >= beta) return 2 * n - 1;

  /* a member of S that tells all the others apart meets the absolute lower bound */
  for (int i = 0; i < n; i++) {
    const uint8_t *row = P + (size_t)ansGuess[S[i]] * A;
    uint8_t seen[NP] = {0}; int ok = 1;
    for (int j = 0; j < n && ok; j++) { int p = row[S[j]]; if (seen[p]) ok = 0; seen[p] = 1; }
    if (ok) { store(S, n, 2 * n - 1, 1, ansGuess[S[i]]); return 2 * n - 1; }
  }

  Cand *cs = malloc(sizeof(Cand) * G); int nc = 0;
  int cnt[NP];
  for (int g = 0; g < G; g++) {
    const uint8_t *row = P + (size_t)g * A;
    memset(cnt, 0, sizeof cnt);
    int parts = 0, big = 0, sq = 0;
    for (int i = 0; i < n; i++) { int c = ++cnt[row[S[i]]]; if (c == 1) parts++; if (c > big) big = c; }
    if (big == n) continue;                       /* tells nothing apart */
    int inS = cnt[WIN] ? 1 : 0;
    int lb = 3 * n - 2 * inS - (parts - inS);
    if (lb >= beta) continue;
    for (int p = 0; p < NP; p++) sq += cnt[p] * cnt[p];
    cs[nc++] = (Cand){lb, g, inS, sq};
  }
  qsort(cs, nc, sizeof(Cand), cmpCand);

  int best = beta, bestG = -1;
  uint16_t *buf = malloc(sizeof(uint16_t) * n);
  int pats[NP], starts[NP], sizes[NP], order[NP];
  for (int c = 0; c < nc; c++) {
    if (cs[c].lb >= best) break;
    int k = split(S, n, cs[c].g, buf, pats, starts, sizes);
    for (int i = 0; i < k; i++) order[i] = i;
    for (int i = 1; i < k; i++) { int t = order[i], j = i; while (j > 0 && sizes[order[j - 1]] < sizes[t]) { order[j] = order[j - 1]; j--; } order[j] = t; }
    int running = cs[c].lb;
    for (int i = 0; i < k && running < best; i++) {
      int q = order[i], sz = sizes[q];
      if (sz <= 2) break;                         /* sorted: the rest are exact at their bound */
      int lbq = lbPart(sz);
      int sub = solve(buf + starts[q], sz, best - running + lbq);
      running += sub - lbq;
    }
    if (running < best) { best = running; bestG = cs[c].g; }
  }
  free(buf); free(cs);
  if (bestG >= 0) store(S, n, best, 1, bestG);
  else store(S, n, beta, 0, -1);
  return best;
}

static int bestGuess(const uint16_t *S, int n) {
  if (n <= 2) return ansGuess[S[0]];
  Entry *e = find(S, n, hashSet(S, n));
  if (!e->h || !e->exact) { solve(S, n, INF); e = find(S, n, hashSet(S, n)); }
  return e->best;
}

static void emit(const uint16_t *S, int n, char *path, int plen) {
  int g = bestGuess(S, n);
  printf("%.*s\t%s\n", plen, path, W[g]);
  if (n == 1) return;
  uint16_t *buf = malloc(sizeof(uint16_t) * n);
  int pats[NP], starts[NP], sizes[NP];
  int k = split(S, n, g, buf, pats, starts, sizes);
  for (int i = 0; i < k; i++) {
    int l = plen + sprintf(path + plen, "%s%d", plen ? "," : "", pats[i]);
    emit(buf + starts[i], sizes[i], path, l);
  }
  free(buf);
}

static int fb(const char *g, const char *a) {
  int cnt[26] = {0}, res[5] = {0}, p = 0;
  for (int i = 0; i < 5; i++) { if (g[i] == a[i]) res[i] = 2; else cnt[a[i] - 'a']++; }
  for (int i = 0; i < 5; i++) if (res[i] != 2 && cnt[g[i] - 'a'] > 0) { cnt[g[i] - 'a']--; res[i] = 1; }
  for (int i = 4; i >= 0; i--) p = p * 3 + res[i];
  return p;
}

static char (*readWords(const char *file, int *n))[6] {
  FILE *f = fopen(file, "r"); if (!f) { perror(file); exit(1); }
  int cap = 16384; char (*w)[6] = malloc(cap * 6); char line[64]; *n = 0;
  while (fgets(line, sizeof line, f)) {
    if (strlen(line) < 5) continue;
    if (*n == cap) { cap *= 2; w = realloc(w, cap * 6); }
    memcpy(w[*n], line, 5); w[*n][5] = 0; (*n)++;
  }
  fclose(f); return w;
}

int main(int argc, char **argv) {
  if (argc < 6) { fprintf(stderr, "usage: solve guesses.txt answers.txt opener WORKERS ID\n"); return 2; }
  int nA; char (*Aw)[6] = readWords(argv[2], &nA);
  W = readWords(argv[1], &G); A = nA;
  int workers = atoi(argv[4]), id = atoi(argv[5]);
  ansGuess = malloc(sizeof(int) * A); guessAns = malloc(sizeof(int) * G);
  for (int g = 0; g < G; g++) guessAns[g] = -1;
  for (int a = 0; a < A; a++) {
    ansGuess[a] = -1;
    for (int g = 0; g < G; g++) if (!strcmp(W[g], Aw[a])) { ansGuess[a] = g; guessAns[g] = a; break; }
    if (ansGuess[a] < 0) { fprintf(stderr, "answer %s is not an allowed guess\n", Aw[a]); return 1; }
  }
  int opener = -1;
  for (int g = 0; g < G; g++) if (!strcmp(W[g], argv[3])) opener = g;
  if (opener < 0) { fprintf(stderr, "opener %s is not an allowed guess\n", argv[3]); return 1; }

  P = malloc((size_t)G * A);
  for (int g = 0; g < G; g++) for (int a = 0; a < A; a++) P[(size_t)g * A + a] = (uint8_t)fb(W[g], Aw[a]);

  tabCap = 1 << 22; tab = calloc(tabCap, sizeof(Entry));
  arenaCap = 1 << 24; arena = malloc(arenaCap * sizeof(uint16_t));

  uint16_t *all = malloc(sizeof(uint16_t) * A), *buf = malloc(sizeof(uint16_t) * A);
  for (int a = 0; a < A; a++) all[a] = (uint16_t)a;
  int pats[NP], starts[NP], sizes[NP], order[NP];
  int k = split(all, A, opener, buf, pats, starts, sizes);
  for (int i = 0; i < k; i++) order[i] = i;
  for (int i = 1; i < k; i++) { int t = order[i], j = i; while (j > 0 && sizes[order[j - 1]] < sizes[t]) { order[j] = order[j - 1]; j--; } order[j] = t; }
  char path[256];
  for (int r = id; r < k; r += workers) {
    int q = order[r];
    int f = solve(buf + starts[q], sizes[q], INF);
    printf("#cost %d %d %d\n", pats[q], sizes[q], f);
    if (argc < 7) { int l = sprintf(path, "%d", pats[q]); emit(buf + starts[q], sizes[q], path, l); }
    fflush(stdout);
    fprintf(stderr, "worker %d: group %d (%d words) costs %d, %lld nodes\n", id, pats[q], sizes[q], f, nodes);
  }
  if (argc >= 7) return 0;
  /* average exact cost by set size, over every set solved exactly */
  static long long sum[2400], num[2400];
  for (uint64_t i = 0; i < tabCap; i++) if (tab[i].h && tab[i].exact) { sum[tab[i].n] += tab[i].val; num[tab[i].n]++; }
  for (int n = 3; n < 2400; n++) if (num[n]) printf("#fit %d %lld %lld\n", n, sum[n], num[n]);
  return 0;
}
