import { useEffect, useRef } from 'react'

interface FluidBackgroundProps {
  isDark: boolean
}

export function FluidBackground({ isDark }: FluidBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let time = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Fluid geometric shapes
    const shapes: Array<{
      x: number
      y: number
      radius: number
      color: string
      speed: number
      phase: number
      amplitude: number
    }> = []

    const colors = isDark
      ? ['rgba(0, 112, 160, 0.15)', 'rgba(102, 162, 205, 0.12)', 'rgba(27, 156, 202, 0.1)', 'rgba(0, 71, 104, 0.2)']
      : ['rgba(0, 112, 160, 0.08)', 'rgba(102, 162, 205, 0.06)', 'rgba(204, 229, 243, 0.15)', 'rgba(0, 87, 124, 0.05)']

    // Initialize shapes
    for (let i = 0; i < 5; i++) {
      shapes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 150 + Math.random() * 250,
        color: colors[i % colors.length],
        speed: 0.0003 + Math.random() * 0.0005,
        phase: Math.random() * Math.PI * 2,
        amplitude: 50 + Math.random() * 100,
      })
    }

    const drawBlob = (x: number, y: number, radius: number, color: string, t: number, phase: number) => {
      ctx.beginPath()
      const points = 8
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const wave = Math.sin(angle * 3 + t + phase) * 0.15 + Math.cos(angle * 2 - t * 0.7) * 0.1
        const r = radius * (1 + wave)
        const px = x + Math.cos(angle) * r
        const py = y + Math.sin(angle) * r
        if (i === 0) {
          ctx.moveTo(px, py)
        } else {
          const prevAngle = ((i - 1) / points) * Math.PI * 2
          const prevWave = Math.sin(prevAngle * 3 + t + phase) * 0.15 + Math.cos(prevAngle * 2 - t * 0.7) * 0.1
          const prevR = radius * (1 + prevWave)
          const cpx1 = x + Math.cos(prevAngle + 0.2) * prevR * 1.1
          const cpy1 = y + Math.sin(prevAngle + 0.2) * prevR * 1.1
          const cpx2 = x + Math.cos(angle - 0.2) * r * 1.1
          const cpy2 = y + Math.sin(angle - 0.2) * r * 1.1
          ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, px, py)
        }
      }
      ctx.closePath()

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.5)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fill()
    }

    const drawWaves = (t: number) => {
      const waveColors = isDark
        ? ['rgba(0, 112, 160, 0.03)', 'rgba(102, 162, 205, 0.02)']
        : ['rgba(0, 112, 160, 0.02)', 'rgba(102, 162, 205, 0.015)']

      for (let w = 0; w < 3; w++) {
        ctx.beginPath()
        ctx.moveTo(0, canvas.height * 0.5)
        for (let x = 0; x <= canvas.width; x += 10) {
          const y = canvas.height * 0.5 + 
            Math.sin(x * 0.003 + t + w * 0.5) * 30 +
            Math.cos(x * 0.007 - t * 0.5 + w) * 20 +
            Math.sin(x * 0.001 + t * 0.3) * 50
          ctx.lineTo(x, y + w * 150)
        }
        ctx.lineTo(canvas.width, canvas.height)
        ctx.lineTo(0, canvas.height)
        ctx.closePath()
        ctx.fillStyle = waveColors[w % waveColors.length]
        ctx.fill()
      }
    }

    const animate = () => {
      time += 0.008
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw waves first (behind)
      drawWaves(time)

      // Draw floating blobs
      shapes.forEach((shape, i) => {
        const x = shape.x + Math.sin(time * shape.speed * 1000 + shape.phase) * shape.amplitude
        const y = shape.y + Math.cos(time * shape.speed * 800 + shape.phase) * shape.amplitude * 0.6
        drawBlob(x, y, shape.radius, shape.color, time + i, shape.phase)
      })

      // Draw subtle geometric lines
      ctx.strokeStyle = isDark ? 'rgba(102, 162, 205, 0.03)' : 'rgba(0, 112, 160, 0.02)'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const y = (canvas.height / 6) * (i + 1)
        ctx.beginPath()
        ctx.moveTo(0, y)
        for (let x = 0; x <= canvas.width; x += 50) {
          ctx.lineTo(x, y + Math.sin(x * 0.01 + time + i) * 20)
        }
        ctx.stroke()
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [isDark])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ 
        filter: 'blur(60px)',
        opacity: 0.8,
      }}
    />
  )
}

// CSS-based geometric background - Draftly style
export function GeometricBackground({ isDark }: FluidBackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient - deep indigo/slate */}
      <div 
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)'
        }}
      />
      
      {/* Animated gradient overlay */}
      <div 
        className="absolute inset-0 opacity-50"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)'
            : 'radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)',
          animation: 'gradient-shift 20s ease infinite'
        }}
      />
      
      {/* Animated gradient orbs - Draftly style with indigo/purple */}
      <div className="absolute inset-0">
        {/* Primary indigo orb */}
        <div 
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: isDark 
              ? 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
            top: '-15%',
            left: '-15%',
            animation: 'float-orb-1 20s ease-in-out infinite',
          }}
        />
        
        {/* Purple orb */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: isDark 
              ? 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
            top: '35%',
            right: '-20%',
            animation: 'float-orb-2 25s ease-in-out infinite',
          }}
        />
        
        {/* Pink accent orb */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: isDark 
              ? 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(236, 72, 153, 0.06) 0%, transparent 70%)',
            bottom: '-10%',
            left: '25%',
            animation: 'float-orb-3 18s ease-in-out infinite',
          }}
        />
        
        {/* Cyan accent orb */}
        <div 
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: isDark 
              ? 'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(6, 182, 212, 0.05) 0%, transparent 70%)',
            top: '60%',
            left: '60%',
            animation: 'float-orb-4 22s ease-in-out infinite',
          }}
        />
        
        {/* Additional Floating Shape - Diamond */}
        <div 
          className="absolute w-[300px] h-[300px]"
          style={{
            background: isDark 
              ? 'radial-gradient(circle, rgba(0,112,160,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(0,112,160,0.04) 0%, transparent 70%)',
            top: '60%',
            left: '10%',
            animation: 'float-orb-4 18s ease-in-out infinite, rotate-slow 40s linear infinite',
            borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
          }}
        />
        
        {/* Floating Ring */}
        <div 
          className="absolute w-[200px] h-[200px]"
          style={{
            border: isDark 
              ? '2px solid rgba(102,162,205,0.1)'
              : '2px solid rgba(0,112,160,0.08)',
            borderRadius: '50%',
            top: '20%',
            right: '20%',
            animation: 'float-orb-5 22s ease-in-out infinite, pulse-ring 4s ease-in-out infinite',
          }}
        />
        
        {/* Geometric Triangle Shape */}
        <div 
          className="absolute w-0 h-0"
          style={{
            borderLeft: '150px solid transparent',
            borderRight: '150px solid transparent',
            borderBottom: isDark 
              ? '260px solid rgba(0,112,160,0.05)'
              : '260px solid rgba(0,112,160,0.03)',
            bottom: '30%',
            right: '5%',
            animation: 'float-orb-6 28s ease-in-out infinite',
            filter: 'blur(40px)',
          }}
        />
      </div>

      {/* Geometric grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0,112,160,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,112,160,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <style>{`
        @keyframes float-orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, 50px) scale(1.05); }
          66% { transform: translate(-20px, 30px) scale(0.95); }
        }
        @keyframes float-orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, -30px) scale(0.95); }
          66% { transform: translate(20px, -50px) scale(1.05); }
        }
        @keyframes float-orb-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, -40px) scale(1.1); }
        }
        @keyframes float-orb-4 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(20px, -30px) rotate(5deg); }
          50% { transform: translate(-10px, -50px) rotate(0deg); }
          75% { transform: translate(30px, -20px) rotate(-5deg); }
        }
        @keyframes float-orb-5 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 40px) scale(1.1); }
        }
        @keyframes float-orb-6 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-30px, 20px) rotate(15deg); }
        }
        @keyframes rotate-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
