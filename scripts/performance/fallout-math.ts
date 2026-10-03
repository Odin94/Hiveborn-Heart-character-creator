import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"
import { DodecahedronGeometry, Quaternion, Vector3 } from "three"
import { lowestPointY } from "../../src/hiveborn/play_mode/fallout_math.js"
const ref = process.argv[2] ?? "545bb09"
const source = execFileSync("git", ["show", `${ref}:src/hiveborn/play_mode/fallout_die.tsx`], { encoding: "utf8" })
const body = source
    .match(/function lowestPointY\([^]*?\n}\n/)?.[0]
    .replace(/geometry: THREE.BufferGeometry, quaternion: THREE.Quaternion/, "geometry, quaternion")
if (!body) throw new Error("Could not extract baseline math")
let allocations = 0
class CountedVector extends Vector3 {
    constructor() {
        super()
        allocations++
    }
}
const baseline = new Function("THREE", `${body};return lowestPointY`)({ Vector3 }) as (geometry: DodecahedronGeometry, quaternion: Quaternion) => number
const countedBaseline = new Function("THREE", `${body};return lowestPointY`)({ Vector3: CountedVector })
const geometry = new DodecahedronGeometry(1, 0),
    scratch = new Vector3()
const rotations = Array.from({ length: 100 }, (_, index) => new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), index / 10))
for (const rotation of rotations) assert.equal(lowestPointY(geometry, rotation, scratch), baseline(geometry, rotation))
const samples = []
for (let pair = 0; pair < 7; pair++)
    for (const variant of pair % 2 ? ["optimized", "baseline"] : ["baseline", "optimized"]) {
        allocations = 0
        if (variant === "baseline") for (let frame = 0; frame < 1000; frame++) countedBaseline(geometry, rotations[frame % 100])
        const start = performance.now()
        let checksum = 0
        for (let frame = 0; frame < 1000; frame++)
            checksum += variant === "baseline" ? baseline(geometry, rotations[frame % 100]) : lowestPointY(geometry, rotations[frame % 100], scratch)
        samples.push({ pair, variant, elapsedMs: performance.now() - start, vertexVectorAllocations: allocations, checksum })
    }
console.log(
    JSON.stringify(
        {
            benchmark: "fallout-lowest-point",
            baselineRef: ref,
            framesPerSample: 1000,
            vertices: geometry.getAttribute("position").count,
            equivalentRotations: rotations.length,
            samples: samples.filter((sample) => sample.pair > 0),
        },
        null,
        2,
    ),
)
geometry.dispose()
