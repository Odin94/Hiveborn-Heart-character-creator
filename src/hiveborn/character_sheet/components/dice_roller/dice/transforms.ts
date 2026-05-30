export const d4Transforms: Record<number, string> = {
    1: "rotateX(0deg) rotateY(0deg) rotateZ(0deg)",
    2: "rotateX(0deg) rotateY(120deg) rotateZ(0deg)",
    3: "rotateX(0deg) rotateY(240deg) rotateZ(0deg)",
    4: "rotateX(0deg) rotateY(60deg) rotateZ(0deg)",
}

const d6FaceAngles: Record<number, { x: number; y: number }> = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: -90 },
    3: { x: -90, y: 0 },
    4: { x: 90, y: 0 },
    5: { x: 0, y: 90 },
    6: { x: 0, y: 180 },
}

export const getD6DieTransform = (face: number) => {
    const angles = d6FaceAngles[face] ?? d6FaceAngles[1]

    return `rotateX(${angles.x}deg) rotateY(${angles.y}deg)`
}

export const getD6RollTransform = (face: number) => {
    const angles = d6FaceAngles[face] ?? d6FaceAngles[1]
    const extraXTurns = face % 2 === 0 ? 1080 : 720
    const extraYTurns = face % 3 === 0 ? 1440 : 1080

    return `rotateX(${angles.x + extraXTurns}deg) rotateY(${angles.y + extraYTurns}deg) rotateZ(720deg)`
}

const d8CoDihedral = 36
const d8TopFaceYaw: Record<number, number> = {
    1: 90,
    2: 0,
    3: 180,
    4: 270,
}

const d8BottomFaceYaw: Record<number, number> = {
    5: 0,
    6: 90,
    7: 180,
    8: 270,
}

export const getD8DieTransform = (face: number) => {
    if (face in d8TopFaceYaw) {
        return `rotateX(${-d8CoDihedral}deg) rotateY(${-d8TopFaceYaw[face]}deg)`
    }

    const yaw = d8BottomFaceYaw[face] ?? d8BottomFaceYaw[5]

    return `rotateX(${-d8CoDihedral}deg) rotateY(${-yaw}deg) rotateX(180deg)`
}

export const getD8RollTransform = (face: number) => {
    if (face in d8TopFaceYaw) {
        return `rotateX(${720 - d8CoDihedral}deg) rotateY(${1080 - d8TopFaceYaw[face]}deg) rotateZ(720deg)`
    }

    const yaw = d8BottomFaceYaw[face] ?? d8BottomFaceYaw[5]

    return `rotateX(${720 - d8CoDihedral}deg) rotateY(${1080 - yaw}deg) rotateX(900deg) rotateZ(720deg)`
}

const d12CoDihedral = -26.57
const d12UpperFaceYaw: Record<number, number> = {
    2: 72,
    3: 144,
    4: 216,
    5: 288,
    6: 360,
}

const d12LowerFaceYaw: Record<number, number> = {
    8: 72,
    9: 144,
    10: 216,
    11: 288,
    12: 360,
}

export const getD12DieTransform = (face: number) => {
    if (face === 1) return "rotateX(-90deg)"
    if (face === 7) return "rotateX(90deg)"

    if (face in d12UpperFaceYaw) {
        return `rotateX(${-d12CoDihedral}deg) rotateY(${-d12UpperFaceYaw[face]}deg)`
    }

    const yaw = d12LowerFaceYaw[face] ?? d12LowerFaceYaw[8]

    return `rotateX(${-d12CoDihedral}deg) rotateY(${-yaw}deg) rotateX(180deg)`
}

export const getD12RollTransform = (face: number) => {
    if (face === 1) return "rotateX(630deg) rotateY(720deg) rotateZ(720deg)"
    if (face === 7) return "rotateX(810deg) rotateY(720deg) rotateZ(720deg)"

    if (face in d12UpperFaceYaw) {
        return `rotateX(${720 - d12CoDihedral}deg) rotateY(${1080 - d12UpperFaceYaw[face]}deg) rotateZ(720deg)`
    }

    const yaw = d12LowerFaceYaw[face] ?? d12LowerFaceYaw[8]

    return `rotateX(${720 - d12CoDihedral}deg) rotateY(${1080 - yaw}deg) rotateX(900deg) rotateZ(720deg)`
}
