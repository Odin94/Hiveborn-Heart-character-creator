export const d10FaceCount = 10

export const getD10DieTransform = (faceIndex: number) => {
    if (faceIndex % 2 === 0) {
        return `rotateX(-45deg) rotateY(${72 * (faceIndex / 2)}deg)`
    }

    return `rotateX(-225deg) rotateY(${-72 * ((faceIndex + 1) / 2)}deg)`
}

export const getD10RollTransform = (faceIndex: number) => {
    if (faceIndex % 2 === 0) {
        return `rotateX(${675}deg) rotateY(${1080 + 72 * (faceIndex / 2)}deg) rotateZ(720deg)`
    }

    return `rotateX(${495}deg) rotateY(${-1080 - 72 * ((faceIndex + 1) / 2)}deg) rotateZ(720deg)`
}
