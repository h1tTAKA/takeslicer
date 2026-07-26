import { useCallback, useEffect, useRef, useState } from 'react'

export interface Playback {
  isPlaying: boolean
  currentTime: number
  toggle: (buffer: AudioBuffer) => void
  seek: (sec: number, buffer?: AudioBuffer) => void
  stop: () => void
}

// AudioBuffer를 Web Audio로 재생. AudioBufferSourceNode는 1회용(start 1번)이라
// 일시정지 = stop + 위치(offset) 기억, 재개 = 그 위치부터 새 source. currentTime은 rAF로 갱신.
export function usePlayback(): Playback {
  const ctxRef = useRef<AudioContext | null>(null)
  const srcRef = useRef<AudioBufferSourceNode | null>(null)
  const bufRef = useRef<AudioBuffer | null>(null)
  const startedAtRef = useRef(0) // 재생 시작 시점의 ctx.currentTime
  const offsetRef = useRef(0) // 재생 시작 시의 버퍼 내 위치(초)
  const rafRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const getCtx = (): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }

  const nowTime = (): number =>
    ctxRef.current ? offsetRef.current + (ctxRef.current.currentTime - startedAtRef.current) : offsetRef.current

  const stopSource = (): void => {
    if (srcRef.current) {
      srcRef.current.onended = null
      try {
        srcRef.current.stop()
      } catch {
        // 이미 멈춘 경우 무시
      }
      srcRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
  }

  const tick = useCallback((): void => {
    const dur = bufRef.current?.duration ?? 0
    const t = nowTime()
    if (t >= dur) {
      stopSource()
      offsetRef.current = 0
      setCurrentTime(0)
      setIsPlaying(false)
      return
    }
    setCurrentTime(t)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const play = useCallback(
    (buffer: AudioBuffer, fromSec: number): void => {
      const ctx = getCtx()
      void ctx.resume() // 브라우저 자동재생 정책: 유저 제스처 후 resume
      stopSource()
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(ctx.destination)
      bufRef.current = buffer
      offsetRef.current = Math.max(0, Math.min(fromSec, buffer.duration))
      startedAtRef.current = ctx.currentTime
      src.start(0, offsetRef.current)
      srcRef.current = src
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    },
    [tick]
  )

  const pause = useCallback((): void => {
    offsetRef.current = nowTime()
    stopSource()
    setCurrentTime(offsetRef.current)
    setIsPlaying(false)
  }, [])

  const toggle = useCallback(
    (buffer: AudioBuffer): void => {
      if (isPlaying) pause()
      else play(buffer, offsetRef.current)
    },
    [isPlaying, play, pause]
  )

  const seek = useCallback(
    (sec: number, buffer?: AudioBuffer): void => {
      const b = buffer ?? bufRef.current
      const clamped = b ? Math.max(0, Math.min(sec, b.duration)) : Math.max(0, sec)
      if (isPlaying && b) play(b, clamped)
      else {
        offsetRef.current = clamped
        setCurrentTime(clamped)
      }
    },
    [isPlaying, play]
  )

  const stop = useCallback((): void => {
    stopSource()
    offsetRef.current = 0
    setCurrentTime(0)
    setIsPlaying(false)
  }, [])

  // 언마운트 시 정리: 소스 정지 + AudioContext 닫기(리소스 누수 방지).
  useEffect(
    () => () => {
      stopSource()
      void ctxRef.current?.close()
      ctxRef.current = null
    },
    []
  )

  return { isPlaying, currentTime, toggle, seek, stop }
}
