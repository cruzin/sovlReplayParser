import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { inferUploader, annotateUploader } = await server.ssrLoadModule("/src/parser/uploaderInference.ts");
  const match = (identifier, ...names) => ({ identifier, players: names.map((name) => ({ name })) });
  assert.equal(inferUploader([match("1", "A", "B")]), null);
  assert.equal(inferUploader([match("1", "A", "B"), match("2", "B", "A")]), null, "Repeated opponents tie");
  const games = [match("1", "Cruz", "A"), match("2", "B", "Cruz"), match("3", "D", "E")];
  assert.equal(inferUploader(games), "Cruz");
  assert.deepEqual(annotateUploader(games, true).map((game) => game.uploader), ["Cruz", "Cruz", null]);
  assert.deepEqual(annotateUploader(games, false).map((game) => game.uploader), [null, null, null]);
  assert.equal(inferUploader([games[0], games[0]]), null, "Duplicate files are not additional games");
  assert.equal(inferUploader([games[0], games[0], match("2", "A", "Other")]), "A", "Duplicates cannot break a tie");
  assert.deepEqual(annotateUploader([match("1", " Cruz ", "A"), match("2", "CRUZ", "B")], true).map((game) => game.uploader), [" Cruz ", "CRUZ"]);
  assert.equal(annotateUploader([match("1", "A", "a"), match("2", "A", "B")], true)[0].uploader, null, "Ambiguous same-name sides stay unset");
  assert.deepEqual(annotateUploader(games, true).map((game) => game.identifier), games.map((game) => game.identifier));
  console.log("Uploader inference checks passed.");
} finally { await server.close(); }
