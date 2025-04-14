import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useLoader, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import SunCalc from 'suncalc'

interface EarthProps {
    size?: number
    position?: [number, number, number]
    isFixed?: boolean
    forceNightTime?: boolean
    targetLocation?: {
        latitude: number
        longitude: number
    } | null
}

interface Location {
    latitude: number
    longitude: number
}

const Earth: React.FC<EarthProps> = ({
    size = 3,
    position = [0, 0, 0],
    isFixed = false,
    forceNightTime = false,
    targetLocation = null
}) => {
    // Settings
    const scale = 1.5
    const resolution = 64
    const atmosphereSize = size * 1.03 // Glow circle radius
    
    const fixedTransitionSpeed = 1.0 // Speed of transition to fixed rotation
    const dragSensitivity = 0.003 // Sensitivity for user dragging

    // Load day and night textures
    const dayTexture = useLoader(THREE.TextureLoader, '/textures/EarthDay.jpg')
    const nightTexture = useLoader(THREE.TextureLoader, '/textures/EarthNight.jpg')

    const [location, setLocation] = useState<Location | null>(null)
    const earthRef = useRef<THREE.Mesh>(null!)
    
    // Initial rotation based on Earth's axial tilt (90 - 23.5 = 66.5 degrees)
    const axisRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        THREE.MathUtils.degToRad(66.5)
    )
    // Use a dedicated ref to store and update the rotation state.
    const rotationRef = useRef<THREE.Quaternion>(axisRotation.clone())

    // For handling drag and physics rotation
    const isDragging = useRef(false)
    const lastPointerPos = useRef<{ x: number; y: number } | null>(null)
    const angularVelocity = useRef(new THREE.Vector3(0, 0, 0)) // in radians per frame (approx)
    const rotationMatrix = new THREE.Matrix4()

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

    // Determine if it's night time based on the location or fallback to local time
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

    // Determine the target quaternion for fixed rotation
    const locationQuaternion = useMemo(() => {
        const targetCoords = targetLocation || location
        if (!targetCoords) return null

        const x = THREE.MathUtils.degToRad(-(69 - targetCoords.latitude)) // Adjusted for texture rotation and viewpoint
        const y = THREE.MathUtils.degToRad(-targetCoords.longitude - 88) // Adjusted for texture rotation 

        const euler = new THREE.Euler(x, y, 0, 'XYZ') 
        const targetQuat = new THREE.Quaternion().setFromEuler(euler)
        
        return targetQuat
    }, [location, targetLocation])

    // Pointer event handlers for dragging
    const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
        // If fixed, disable drag behavior
        if (isFixed) return
        isDragging.current = true
        lastPointerPos.current = { x: event.clientX, y: event.clientY }
        event.stopPropagation()
    }

    const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
        if (isFixed || !isDragging.current || !lastPointerPos.current) return

        const deltaX = event.clientX - lastPointerPos.current.x
        const deltaY = event.clientY - lastPointerPos.current.y

        const angleX = deltaY * dragSensitivity // Rotation around X-axis (vertical drag)
        const angleY = deltaX * dragSensitivity // Rotation around Y-axis (horizontal drag)

        // Create quaternions for the incremental rotations
        const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleX)
        const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY)

        // Combine the rotations
        const dragQuat = new THREE.Quaternion().multiplyQuaternions(qY, qX)
        // Update the dedicated rotation state instead of directly modifying the mesh
        rotationRef.current.premultiply(dragQuat)

        // Update angular velocity (a rough estimate based on drag delta)
        const dragAngle = Math.sqrt(angleX * angleX + angleY * angleY)
        const axis = new THREE.Vector3(angleY, angleX, 0).normalize()
        angularVelocity.current.copy(axis.multiplyScalar(dragAngle))

        // Update last pointer position for the next movement
        lastPointerPos.current = { x: event.clientX, y: event.clientY }
    }

    const onPointerUp = () => {
        if (isFixed) return
        isDragging.current = false
        lastPointerPos.current = null
    }    

    // Main animation loop using our dedicated rotation state
    useFrame((_, delta) => {
        if (!earthRef.current) return

        if (isFixed && locationQuaternion) {
            // Smoothly interpolate the dedicated rotation toward the target rotation
            rotationRef.current.slerp(locationQuaternion, delta * fixedTransitionSpeed)
        } else if (!isDragging.current) {
            // Check if there's a residual angular velocity from dragging
            const speed = angularVelocity.current.length()
            const velocityThreshold = 0.005  // Minimum angular velocity to continue physics-based rotation

            if (speed > velocityThreshold) {
                const axis = angularVelocity.current.clone().normalize()
                const angle = speed * delta
                const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle)
                rotationRef.current.premultiply(deltaQuat)

                const friction = 0.98  // Friction factor for decay
                angularVelocity.current.multiplyScalar(friction)
            } else {
                // Base animation rotation when no dragging or fixed behavior is active
                const baseRotation = delta * 0.025
                rotationMatrix.makeRotationAxis(
                    new THREE.Vector3(0, 1, 0).applyQuaternion(axisRotation),
                    baseRotation
                )
                rotationRef.current.premultiply(new THREE.Quaternion().setFromRotationMatrix(rotationMatrix))
            }
        }
        // Always copy the current rotation state to the mesh for rendering
        earthRef.current.quaternion.copy(rotationRef.current)
    })

    // Atmosphere shader
    const atmosphereMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {
            glowColor: { value: new THREE.Color(0x88ccff) },
            viewVector: { value: new THREE.Vector3(0, 0, 1) },
            innerRadius: { value: size - 1.25 },
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
                float height = (length(vWorldPosition) - innerRadius) / (outerRadius - innerRadius);
                float density = exp(-height * intensityFactor);
                gl_FragColor = vec4(glowColor, (density * 0.5));
            }
        `
    })

    return (
        <>
            {/* Earth Mesh with pointer event handlers */}
            <mesh 
                ref={earthRef} 
                position={position}
                scale={[scale, scale, scale]}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerOut={onPointerUp}
            >
                <sphereGeometry args={[size, resolution, resolution]} />
                <meshStandardMaterial 
                    map={(isNightTime || forceNightTime) ? nightTexture : dayTexture}
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
