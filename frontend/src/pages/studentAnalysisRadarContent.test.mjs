import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const source = await readFile(new URL("./StudentAnalysis.jsx", import.meta.url), "utf8")
const radarStart = source.indexOf("const radarData")
const radarEnd = source.indexOf("const studentOptions")
assert.ok(radarStart > -1 && radarEnd > radarStart, "should contain radar data/config block")
const radarBlock = source.slice(radarStart, radarEnd)

assert.match(radarBlock, /score_rate/, "radar should use normalized score rate field")
assert.match(radarBlock, /scale\s*:\s*\{/, "radar should define explicit scale")
assert.match(radarBlock, /y\s*:\s*\{[^}]*domain\s*:\s*\[\s*0\s*,\s*100\s*\]/s, "radar y scale domain should be fixed to 0-100")
assert.match(radarBlock, /y\s*:\s*\{[^}]*min\s*:\s*0/s, "radar y scale should define min 0")
assert.match(radarBlock, /y\s*:\s*\{[^}]*max\s*:\s*100/s, "radar y scale should define max 100")
assert.match(radarBlock, /axis\s*:\s*\{[^}]*y\s*:\s*\{[^}]*nice\s*:\s*false/s, "radar y axis should disable nice auto-scaling")
assert.match(radarBlock, /student_score/, "radar tooltip/data should include student_score")
assert.match(radarBlock, /full_score/, "radar tooltip/data should include full_score")
assert.doesNotMatch(radarBlock, /科目满分/, "radar should not render a full-score series")
assert.doesNotMatch(radarBlock, /seriesField:/, "radar should not use multi-series type field")

console.log("student analysis radar content checks passed")
