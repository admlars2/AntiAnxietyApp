import React, { memo } from "react"
import { Canvas } from "@react-three/fiber"
import Earth from "../../components/Earth/Earth"

interface SceneProps {
    isEarthFixed: boolean
    forceNightTime: boolean
    targetLocation?: {
        latitude: number
        longitude: number
    } | null
}

const EarthScene: React.FC<SceneProps> = memo(({ isEarthFixed, forceNightTime, targetLocation }) => {
    return (
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <ambientLight intensity={0.05} />
            <pointLight position={[0, 0, 2]} intensity={3} />
            <Earth size={4} position={[0, -7, 0]} isFixed={isEarthFixed} forceNightTime={forceNightTime} targetLocation={targetLocation} />
        </Canvas>
    )
})

export default EarthScene