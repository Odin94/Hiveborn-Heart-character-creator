import * as THREE from "three"
import { useEffect, useRef, useState } from "react"
import { getOnPageRollFadeDelayMs, OnPageRollOverlay } from "@/components/on-page-roll-overlay"

import { falloutRollAnimationMs } from "./fallout_timing"
import { lowestPointY } from "./fallout_math"
import { prefersReducedMotion } from "@/hiveborn/character_sheet/components/dice_roller/reduced_motion"

type Face = {
    value: number
    normal: THREE.Vector3
    center: THREE.Vector3
    labelUp?: THREE.Vector3
}

type FalloutDieProps = {
    characterName: string
    value: number
    fallout: "minor" | "major" | null
}

const FLOOR_Y = -1.3
const UP = new THREE.Vector3(0, 1, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)

function extractFaces(geometry: THREE.BufferGeometry): Face[] {
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    const positions = nonIndexed.getAttribute("position")
    const faces: Array<Omit<Face, "value"> & { count: number }> = []

    for (let index = 0; index < positions.count; index += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(positions, index)
        const b = new THREE.Vector3().fromBufferAttribute(positions, index + 1)
        const c = new THREE.Vector3().fromBufferAttribute(positions, index + 2)
        const center = a
            .clone()
            .add(b)
            .add(c)
            .multiplyScalar(1 / 3)
        const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
        if (normal.dot(center) < 0) normal.negate()

        const matchingFace = faces.find((face) => face.normal.dot(normal) > 0.999)
        if (matchingFace) {
            matchingFace.center.add(center)
            matchingFace.count += 1
        } else {
            faces.push({ normal, center, count: 1 })
        }
    }

    nonIndexed.dispose()
    return faces.map((face, index) => ({ value: index + 1, normal: face.normal, center: face.center.multiplyScalar(1 / face.count) }))
}

function makeNumberLabel(face: Face) {
    const source = document.createElement("canvas")
    source.width = source.height = 256
    const context = source.getContext("2d")!
    // Bone ink with a dried-blood outline, set in the display face (Grenze) like the rest of the app.
    context.fillStyle = "#fbf6ec"
    context.strokeStyle = "#2a0a0e"
    context.lineWidth = 16
    context.lineJoin = "round"
    context.font = "700 168px Grenze, Georgia, serif"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.strokeText(String(face.value), 128, 136)
    context.fillText(String(face.value), 128, 136)

    const texture = new THREE.CanvasTexture(source)
    texture.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.04, depthWrite: false })
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), material)
    label.position.copy(face.center).addScaledVector(face.normal, 0.018)
    label.quaternion.setFromUnitVectors(Z_AXIS, face.normal)
    face.labelUp = Y_AXIS.clone().applyQuaternion(label.quaternion)
    return label
}

function smoothstep(value: number) {
    return value * value * (3 - 2 * value)
}

/**
 * A server result is supplied before this component mounts. Animation only
 * presents that result, so the visual die can never determine fallout.
 */
export default function FalloutDie({ characterName, value, fallout }: FalloutDieProps) {
    const stageRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [webglUnavailable, setWebglUnavailable] = useState(false)
    const [settled, setSettled] = useState(false)

    useEffect(() => {
        const stage = stageRef.current
        const canvas = canvasRef.current
        if (!stage || !canvas) return

        let renderer: THREE.WebGLRenderer
        try {
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
        } catch {
            setWebglUnavailable(true)
            return
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
        camera.position.set(0, 5.6, 9.2)
        camera.lookAt(0, 0, 0)

        const keyLight = new THREE.DirectionalLight(0xffcb78, 4.2)
        keyLight.position.set(4, 8, 5)
        scene.add(keyLight)
        const fillLight = new THREE.HemisphereLight(0xffe7b0, 0x24111b, 2.1)
        scene.add(fillLight)
        // Cold Vermissian-iron rim against the warm heart-light key.
        const rimLight = new THREE.DirectionalLight(0x8ea6cf, 1.5)
        rimLight.position.set(-5, 3, -4)
        scene.add(rimLight)

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.ShadowMaterial({ color: 0x16070b, opacity: 0.35 }))
        floor.rotation.x = -Math.PI / 2
        floor.position.y = FLOOR_Y
        floor.receiveShadow = true
        scene.add(floor)

        const geometry = new THREE.DodecahedronGeometry(1.25, 0)
        const faces = extractFaces(geometry)
        const targetFace = faces.find((face) => face.value === value)
        if (!targetFace) throw new Error("Could not map fallout die face")
        const die = new THREE.Group()
        // Crimson resin, matching the CSS dice (--hb-crimson-600).
        const dieMaterial = new THREE.MeshStandardMaterial({ color: 0xa31d25, roughness: 0.26, metalness: 0.28, flatShading: true })
        const body = new THREE.Mesh(geometry, dieMaterial)
        body.castShadow = true
        body.receiveShadow = true
        die.add(body)
        const labels = faces.map(makeNumberLabel)
        die.add(...labels)
        scene.add(die)

        const vertex = new THREE.Vector3()
        const base = new THREE.Quaternion()
        const spin = new THREE.Quaternion()
        const position = new THREE.Vector3()
        const end = new THREE.Vector3(0, FLOOR_Y, 0)
        const viewerDirection = camera.position.clone().sub(end).normalize().lerp(UP, 0.42).normalize()
        const faceAlignment = new THREE.Quaternion().setFromUnitVectors(targetFace.normal, viewerDirection)
        const labelUp = targetFace.labelUp!.clone().applyQuaternion(faceAlignment).projectOnPlane(viewerDirection).normalize()
        const cameraUp = camera.up.clone().projectOnPlane(viewerDirection).normalize()
        const uprightAngle = Math.atan2(new THREE.Vector3().crossVectors(labelUp, cameraUp).dot(viewerDirection), labelUp.dot(cameraUp))
        const target = new THREE.Quaternion().setFromAxisAngle(viewerDirection, uprightAngle).multiply(faceAlignment)
        end.y = FLOOR_Y + 0.015 - lowestPointY(geometry, target, vertex)

        const initial = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6))
        const start = new THREE.Vector3((Math.random() - 0.5) * 8, 2.7, 4.2)
        const path = new THREE.CubicBezierCurve3(start, new THREE.Vector3(-3.4, 3.4, 2), new THREE.Vector3(2.8, 1.1, 1), end)
        const spinAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, -1).normalize()
        // Reduced motion: the die is already resting on its result in the first frame.
        const startedAt = performance.now() - (prefersReducedMotion() ? falloutRollAnimationMs : 0)
        let frameId = 0

        const resize = () => {
            const { width, height } = stage.getBoundingClientRect()
            renderer.setSize(width, height, false)
            camera.aspect = width / height
            // Portrait screens: widen the vertical FOV so the die keeps its horizontal framing.
            camera.fov =
                camera.aspect < 1.2 ? Math.min(75, THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(18)) * 1.2) / camera.aspect))) : 36
            camera.updateProjectionMatrix()
        }
        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(stage)
        resize()

        const frame = (now: number) => {
            const progress = Math.min((now - startedAt) / falloutRollAnimationMs, 1)
            const travel = smoothstep(progress)
            base.copy(initial).slerp(target, travel)
            spin.setFromAxisAngle(spinAxis, Math.PI * 2 * 4 * smoothstep(progress))
            die.quaternion.copy(base.multiply(spin))
            die.position.copy(path.getPoint(travel, position))
            die.position.y =
                FLOOR_Y + 0.015 - lowestPointY(geometry, die.quaternion, vertex) + Math.sin(Math.PI * progress * 2) ** 2 * 0.23 * (1 - progress * 0.55)
            if (progress === 1) {
                die.position.copy(end)
                die.quaternion.copy(target)
                setSettled(true)
            }
            renderer.render(scene, camera)
            if (progress < 1) frameId = requestAnimationFrame(frame)
        }
        frameId = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(frameId)
            resizeObserver.disconnect()
            labels.forEach((label) => {
                label.geometry.dispose()
                const material = label.material as THREE.MeshBasicMaterial
                material.map?.dispose()
                material.dispose()
            })
            geometry.dispose()
            dieMaterial.dispose()
            floor.geometry.dispose()
            ;(floor.material as THREE.Material).dispose()
            renderer.dispose()
        }
    }, [value])

    const outcome = fallout ? `${fallout[0].toUpperCase()}${fallout.slice(1)} fallout` : "No fallout"
    const showResult = webglUnavailable || settled
    return (
        <OnPageRollOverlay
            className="z-(--z-popover)"
            fadeDelayMs={getOnPageRollFadeDelayMs(falloutRollAnimationMs)}
            blockInteraction
            role="status"
            aria-live="assertive"
        >
            <div className="heart-roll-vignette" data-strength="strong" aria-hidden="true" />
            <div ref={stageRef} className="relative h-full w-full overflow-hidden">
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
                <div className="absolute inset-x-0 top-[max(2rem,calc(var(--safe-top)+1.5rem))] px-6 text-center">
                    <p className="text-xs font-bold tracking-[0.22em] text-crimson-300 uppercase">Fallout roll</p>
                    <h2 className="mt-1.5 font-display text-3xl leading-tight font-bold text-bone-50 [text-shadow:0_2px_12px_oklch(0_0_0/0.6)] sm:text-4xl">
                        {characterName}
                    </h2>
                </div>
                <div className="absolute inset-x-0 bottom-[max(2.5rem,calc(var(--safe-bottom)+1.5rem))] px-6 text-center">
                    {showResult ? (
                        <div className="fallout-die-result animate-hb-rise-in" data-fallout={fallout ?? "none"}>
                            {webglUnavailable && <p className="font-display text-6xl leading-none font-bold text-bone-50">{value}</p>}
                            <p className="fallout-die-outcome mt-1 font-display text-3xl leading-tight font-bold [text-shadow:0_2px_12px_oklch(0_0_0/0.6)] sm:text-4xl">
                                {outcome} · {value}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm font-semibold text-bone-300">The die is settling…</p>
                    )}
                </div>
            </div>
        </OnPageRollOverlay>
    )
}
