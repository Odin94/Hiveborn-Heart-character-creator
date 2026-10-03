import type { BufferGeometry, Quaternion, Vector3 } from "three"

/** Reuse one scratch vector throughout a roll instead of allocating per vertex/frame. */
export function lowestPointY(geometry: BufferGeometry, quaternion: Quaternion, vertex: Vector3) {
    const positions = geometry.getAttribute("position")
    let lowest = Infinity
    for (let index = 0; index < positions.count; index++) {
        lowest = Math.min(lowest, vertex.fromBufferAttribute(positions, index).applyQuaternion(quaternion).y)
    }
    return lowest
}
