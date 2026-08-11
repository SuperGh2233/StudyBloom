import { describe, expect, it } from 'vitest'
import { LOCATION_LIMITS } from '../types'
import {
  assertAccuracy,
  distanceToLocationM,
  formatDistanceM,
  haversineDistanceM,
  isWithinRadius,
} from './geolocation'

const location = { latitude: 31.2304, longitude: 121.4737, radiusM: 200 }

describe('定位与距离', () => {
  it('相同坐标距离为 0', () => {
    expect(haversineDistanceM(31.2304, 121.4737, 31.2304, 121.4737)).toBe(0)
  })

  it('约 0.001 纬度差约为 111 米', () => {
    const distance = haversineDistanceM(31.2304, 121.4737, 31.2314, 121.4737)
    expect(distance).toBeGreaterThan(110)
    expect(distance).toBeLessThan(113)
  })

  it('签到范围内判断正确', () => {
    // ~111 米，小于 200 米半径
    expect(isWithinRadius({ latitude: 31.2314, longitude: 121.4737 }, location)).toBe(true)
    expect(distanceToLocationM({ latitude: 31.2314, longitude: 121.4737 }, location)).toBeLessThanOrEqual(location.radiusM)
  })

  it('签到范围外判断正确', () => {
    // ~556 米，超出 200 米半径
    const outside = { latitude: 31.2354, longitude: 121.4737, accuracyM: 20 }
    expect(isWithinRadius(outside, location)).toBe(false)
    expect(distanceToLocationM(outside, location)).toBeGreaterThan(location.radiusM)
  })

  it('定位精度不足时拒绝操作', () => {
    expect(() => assertAccuracy({ latitude: 31.2304, longitude: 121.4737, accuracyM: LOCATION_LIMITS.accuracyLimitM + 1 }))
      .toThrow('当前定位精度不足，请移动到窗边或室外后重试。')
    expect(() => assertAccuracy({ latitude: 31.2304, longitude: 121.4737, accuracyM: 150 })).not.toThrow()
    expect(() => assertAccuracy({ latitude: 31.2304, longitude: 121.4737, accuracyM: Number.NaN })).toThrow('定位数据不正确')
  })

  it('距离格式化带单位', () => {
    expect(formatDistanceM(436.2)).toBe('436 米')
  })
})
