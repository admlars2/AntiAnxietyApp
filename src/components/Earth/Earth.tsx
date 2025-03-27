import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import SunCalc from 'suncalc'

interface EarthProps {
    size?: number
    position?: [number, number, number]
    scrollPosition?: number
}

interface Location {
    latitude: number
    longitude: number
}

const Earth: React.FC<EarthProps> = ({ size = 3, position = [0, 0, 0], scrollPosition = 0 }) => {
    const [location, setLocation] = useState<Location | null>(null)
    const earthRef = useRef<THREE.Mesh>(null!)
    const rotationMatrix = new THREE.Matrix4()
    const axisRotation = new THREE.Quaternion()

    // Get user location
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    })
                },
                (error) => {
                    console.error("Error getting location:", error)
                    // Fallback to default location (e.g., UTC)
                    setLocation({ latitude: 0, longitude: 0 })
                }
            )
        }
    }, [])

    const isNightTime = useMemo(() => {
        if (!location) return false
        const now = new Date()
        const times = SunCalc.getTimes(now, location.latitude, location.longitude)
        return now > times.sunset || now < times.sunrise
    }, [location])

    // Set the axis rotation (50 degrees around Z axis)
    axisRotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(66.5))

    // Load day and night textures
    const dayTexture = useLoader(THREE.TextureLoader, '/textures/EarthDay.jpg')
    const nightTexture = useLoader(THREE.TextureLoader, '/textures/EarthNight.jpg')

    // Load a gradient map for toon shading (cartoon look)
    const gradientMap = useLoader(THREE.TextureLoader, '/textures/gradientMap.png')
    gradientMap.minFilter = THREE.NearestFilter
    gradientMap.magFilter = THREE.NearestFilter
    gradientMap.generateMipmaps = false

    // Atmosphere shader material
    const atmosphereMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {
            glowColor: { value: new THREE.Color(0x88ccff) },
            viewVector: { value: new THREE.Vector3(0, 0, 1) }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPositionW;
            
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vPositionW = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            uniform vec3 glowColor;
            
            void main() {
                float angle = dot(normalize(vNormal), vec3(0, 0, 1.0));
                float intensity = smoothstep(0.0, 1.0, 1.0 - angle);
                float alpha = intensity * 0.3;
                gl_FragColor = vec4(glowColor, alpha);
            }
        `
    });

    useFrame((_, delta) => {
        if (earthRef.current) {
            // Rotate the Earth around its Y axis
            rotationMatrix.makeRotationAxis(
                new THREE.Vector3(0, 1, 0).applyQuaternion(axisRotation),
                delta * 0.025
            )
            earthRef.current.quaternion.premultiply(
                new THREE.Quaternion().setFromRotationMatrix(rotationMatrix)
            )

            // Update position based on scroll (parallax effect)
            const scrollFactor = scrollPosition / window.innerHeight
            earthRef.current.position.y = position[1] - (scrollFactor * 2)
        }
    })

    return (
        <>
            <mesh 
                ref={earthRef} 
                position={position}
                scale={[1.5, 1.5, 1.5]}
                quaternion={axisRotation}
            >
                <sphereGeometry args={[size, 64, 64]} />
                {/* Use MeshToonMaterial for a cartoon look */}
                <meshToonMaterial 
                    map={isNightTime ? dayTexture : nightTexture}
                    gradientMap={gradientMap}
                />
            </mesh>
            <mesh
                position={position}
                scale={[1.5, 1.5, 1.5]}
            >
                <sphereGeometry args={[size * 1.025, 64, 64]} />
                <primitive object={atmosphereMaterial} attach="material" />
            </mesh>
        </>
    )
}

export default Earth
