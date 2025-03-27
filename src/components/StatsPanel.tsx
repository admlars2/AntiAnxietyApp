import { useEffect } from 'react'
import Stats from 'stats.js'

export const StatsPanel = () => {
    useEffect(() => {
        const stats = new Stats()
        stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(stats.dom)

        function animate() {
            stats.begin()
            stats.end()
            requestAnimationFrame(animate)
        }

        requestAnimationFrame(animate)

        return () => {
            document.body.removeChild(stats.dom)
        }
    }, [])

    return null
}