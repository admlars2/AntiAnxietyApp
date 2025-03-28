import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react"
import {
    type Container,
    type ISourceOptions,
    MoveDirection,
    OutMode,
} from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim"
import { Canvas } from "@react-three/fiber"
// import { Link } from "react-router-dom"
// import { ROUTES } from "../../routing/config"
import styles from "./Landing.module.css"
import Earth from "../../components/Earth/Earth"
import { StatsPanel } from "../../components/StatsPanel";

const Landing: React.FC = () => {
    const [init, setInit] = useState(false);
   
    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    const particlesLoaded = async (container?: Container): Promise<void> => {
        console.log(container);
    };

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
                    }
                },
            },
            detectRetina: true,
        }), []
    );

    if (!init) {
        return (
            <div>Loading...</div>
        )
    }

    return (
        <main className={styles.landing}>
            <StatsPanel />
            <Particles 
                id="tsparticles" 
                options={options} 
                particlesLoaded={particlesLoaded} 
                className={styles.particles}
            />
            <div className={styles.planets}>
                <Canvas
                    camera={{ position: [0, 0, 8], fov: 45 }}
                    className={styles.earth}
                >
                    {/* Add lights */}
                    <ambientLight intensity={1.5} />
                    <pointLight position={[10, 10, 10]} intensity={20} />
                    <Earth size={4} position={[0, -7, 0]} />
                </Canvas>
            </div>

            <div className={styles.content}>
                <h1 className={styles.title}>Welcome to my Portfolio</h1>  
            </div>
        </main>
    )
}

export default Landing

