import React, { useEffect, useMemo, useState, memo } from "react"
import Particles from "@tsparticles/react"
import {
    type ISourceOptions,
    MoveDirection,
    OutMode,
} from "@tsparticles/engine"
import { initParticlesEngine } from "@tsparticles/react"
import { loadSlim } from "@tsparticles/slim"
import styles from "./Landing.module.css"
import { StatsPanel } from "../../components/StatsPanel"
import EarthScene from "../../components/Earth/EarthScene"

// Memoized Particles Component
const ParticleBackground = memo(({ options }: { options: ISourceOptions }) => (
        <Particles 
            id="tsparticles"
            options={options}
            className={styles.stars}
        />
    )
)

const Landing: React.FC = () => {
    const [init, setInit] = useState(false)
    const [isEarthFixed, setIsEarthFixed] = useState(false)
    const [forceIsNightTime, setForceIsNightTime] = useState(false)
   
    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine)
        }).then(() => {
            setInit(true)
        })
    }, [])

    const options: ISourceOptions = useMemo(
        () => ({
            background: {
                color: {
                    value: "transparent",
                },
            },
            fpsLimit: 120,
            particles: {
                color: {
                    value: "#ffffff",
                },
                move: {
                    direction: MoveDirection.none,
                    enable: true,
                    outModes: {
                        default: OutMode.out,
                    },
                    random: true,
                    speed: 0,
                    straight: false,
                },
                number: {
                    density: {
                        enable: true,
                        area: 800,
                    },
                    value: 100,
                },
                opacity: {
                    animation: {
                        enable: true,
                        speed: 0.25,
                        minimumValue: 0.1,
                        sync: false,
                    },
                    value: { min: 0.1, max: 0.5 },
                },
                shape: {
                    type: "circle",
                },
                size: {
                    value: { min: 1, max: 3 },
                    animation: {
                        enable: true,
                        speed: 0.5,
                        minimumValue: 0.1,
                        sync: false,
                    },
                },
            },
            detectRetina: true,
        }),
        []
    )

    if (!init) {
        return <div>Loading...</div>
    }

    return (
        <main className={styles.landing}>
            <StatsPanel />
            <ParticleBackground options={options} />
            <div className={styles.planets}>
                <EarthScene 
                    isEarthFixed={isEarthFixed} 
                    forceNightTime={forceIsNightTime} 
                    targetLocation={null}
                />
            </div>

            <div className={styles.content}>
                <h1 className={styles.title}>Welcome to my Portfolio</h1>
                <button 
                    className={styles.button} 
                    onClick={() => setIsEarthFixed(!isEarthFixed)}
                >
                    Show My Location
                </button>
                <button 
                    className={styles.button} 
                    onClick={() => setForceIsNightTime(!forceIsNightTime)}
                >
                    Night Time
                </button>
                <button>Does Nothing</button>
            </div>
        </main>
    )
}

export default Landing
