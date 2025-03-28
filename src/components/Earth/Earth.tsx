import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import SunCalc from 'suncalc'

interface EarthProps {
    size?: number
    position?: [number, number, number]
}

interface Location {
    latitude: number
    longitude: number
}

const Earth: React.FC<EarthProps> = ({ size = 3, position = [0, 0, 0] }) => {
    // Settings
    const scale = 1.5;
    const resolution = 64;
    const atmosphereSize = size * 1.03; // Glow circle radius

    const [location, setLocation] = useState<Location | null>(null)
    const earthRef = useRef<THREE.Mesh>(null!)
    const rotationMatrix = new THREE.Matrix4()
    const axisRotation = new THREE.Quaternion()

    // For handling drag and physics rotation
    const isDragging = useRef(false)
    const lastPointerPos = useRef<{ x: number; y: number } | null>(null)
    const angularVelocity = useRef(new THREE.Vector3(0, 0, 0)) // in radians per frame (approx)

    // Load day and night textures
    const dayTexture = useLoader(THREE.TextureLoader, '/textures/EarthDay.jpg')
    const nightTexture = useLoader(THREE.TextureLoader, '/textures/EarthNight.jpg')

    // Load gradient map for toon shading (cartoon look)
    const gradientMap = useLoader(THREE.TextureLoader, '/textures/gradient.png')
    gradientMap.minFilter = THREE.NearestFilter
    gradientMap.magFilter = THREE.NearestFilter
    gradientMap.generateMipmaps = false

    // Get user location for day or night
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    })
                },
                () => {
                    setLocation(null)
                }
            )
        }
    }, [])

    const isNightTime = useMemo(() => {
        if (!location) {
            // Fallback to local time check
            const hour = new Date().getHours()
            return hour <= 6 || hour >= 18 // Guessed night time between 6pm and 6am
        }
        // Precise calculation using location
        const now = new Date()
        const times = SunCalc.getTimes(now, location.latitude, location.longitude)
        return now > times.sunset || now < times.sunrise
    }, [location])

    // Set the initial axis rotation (tilt of 66.5 degrees around the Z axis)
    axisRotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(66.5))

    // Pointer event handlers for dragging
    const onPointerDown = (event: any) => {
        isDragging.current = true
        lastPointerPos.current = { x: event.clientX, y: event.clientY }
        // Optionally, you can stop propagation to avoid interfering with other controls
        event.stopPropagation()
    }

    const onPointerMove = (event: any) => {
        if (!isDragging.current || !lastPointerPos.current) return

        const deltaX = event.clientX - lastPointerPos.current.x
        const deltaY = event.clientY - lastPointerPos.current.y

        // Adjust sensitivity as needed
        const sensitivity = 0.005
        const angleX = deltaY * sensitivity // Rotation around X-axis (vertical drag)
        const angleY = deltaX * sensitivity // Rotation around Y-axis (horizontal drag)

        // Create quaternions for the incremental rotations
        const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleX)
        const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY)

        // Combine the rotations
        const dragQuat = new THREE.Quaternion().multiplyQuaternions(qY, qX)
        earthRef.current.quaternion.premultiply(dragQuat)

        // Update angular velocity (a rough estimate based on drag delta)
        const dragAngle = Math.sqrt(angleX * angleX + angleY * angleY)
        // An approximate axis – this is a simplification and may be refined
        const axis = new THREE.Vector3(angleY, angleX, 0).normalize()
        angularVelocity.current.copy(axis.multiplyScalar(dragAngle))

        // Update last pointer position for the next movement
        lastPointerPos.current = { x: event.clientX, y: event.clientY }
    }

    const onPointerUp = () => {
        isDragging.current = false
        lastPointerPos.current = null
    }

    // Modify the animation loop to include physics and drag
    useFrame((_, delta) => {
        if (!earthRef.current) return

        if (!isDragging.current) {
            // Check if there's a residual angular velocity from dragging
            const speed = angularVelocity.current.length()
            const velocityThreshold = 0.001  // Minimum angular velocity to continue physics-based rotation

            if (speed > velocityThreshold) {
                // Apply physics-based rotation using the current angular velocity
                const axis = angularVelocity.current.clone().normalize()
                // Multiply by delta to have time-based rotation
                const angle = speed * delta
                const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle)
                earthRef.current.quaternion.premultiply(deltaQuat)

                // Apply friction to gradually reduce the angular velocity
                const friction = 0.98  // Adjust friction as needed (closer to 1 = slower decay)
                angularVelocity.current.multiplyScalar(friction)
            } else {
                // No significant angular velocity: revert to the base animation
                const baseRotation = delta * 0.025
                rotationMatrix.makeRotationAxis(
                    new THREE.Vector3(0, 1, 0).applyQuaternion(axisRotation),
                    baseRotation
                )
                earthRef.current.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(rotationMatrix))
            }
        }
        // When dragging, rotation is controlled by pointer events (onPointerMove)
    })

    const atmosphereMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {
            glowColor: { value: new THREE.Color(0x88ccff) },
            viewVector: { value: new THREE.Vector3(0, 0, 1) },
            innerRadius: { value: size - 1.0 },
            outerRadius: { value: atmosphereSize },
            intensityFactor: { value: 1.0 },
            objectPosition: { value: position }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            varying vec3 vPosition;
            
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                vPosition = position;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vWorldPosition;
            varying vec3 vPosition;
            uniform vec3 glowColor;
            uniform float innerRadius;
            uniform float outerRadius;
            uniform float intensityFactor;
            uniform vec3 objectPosition;
            
            void main() {
                // Calculate atmospheric density based on height
                float height = (length(vWorldPosition) - innerRadius) / (outerRadius - innerRadius);
                float density = exp(-height * intensityFactor);
                
                // Final color
                gl_FragColor = vec4(glowColor, (density * 0.5));
            }
        `
    });

    return (
        <>
            {/* Earth Mesh with pointer event handlers */}
            <mesh 
                ref={earthRef} 
                position={position}
                scale={[scale, scale, scale]}
                quaternion={axisRotation}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                // Optionally, you may want to listen to onPointerOut to end dragging if the pointer leaves the object
                onPointerOut={onPointerUp}
            >
                <sphereGeometry args={[size, resolution, resolution]} />
                <meshToonMaterial 
                    map={isNightTime ? nightTexture : dayTexture}
                    gradientMap={gradientMap}
                />
            </mesh>

            {/* Glow Shader */}
            <mesh
                position={position}
                scale={[scale, scale, scale]}
            >
                <sphereGeometry args={[atmosphereSize, resolution, resolution]} />
                <primitive object={atmosphereMaterial} attach="material" />
            </mesh>
        </>
    )
}

export default Earth