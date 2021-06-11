import * as fs from 'fs'
import { PNG, PNGWithMetadata } from 'pngjs'

export default class Photoman {
  private imageAPath: string
  private imageBPath: string
  private threshold: number = 5

  constructor({ imageAPath, imageBPath }: { imageAPath: string; imageBPath: string }) {
    this.imageAPath = imageAPath
    this.imageBPath = imageBPath
  }

  compare() {
    const img1 = PNG.sync.read(fs.readFileSync(this.imageAPath))
    const img2 = PNG.sync.read(fs.readFileSync(this.imageBPath))

    if (img1.data.length !== img2.data.length) {
      throw new Error('Image size not match')
    }

    const { width, height } = img1
    const len = width * height
    const a32 = new Uint32Array(img1.data.buffer, img1.data.byteOffset, len)
    const b32 = new Uint32Array(img2.data.buffer, img2.data.byteOffset, len)
    const outputPng = new PNG({ width, height })
    const output = outputPng.data
    const matrix = this.getMatrix(height, width, null)
    let pxCount = 0

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = (y * width + x) * 4
        const delta = this.colorDelta(img1.data, img2.data, pos, pos)
        if (delta) {
          pxCount++
          matrix[y][x] = 0
          this.drawPixel(output, pos, img2.data[pos + 0], img2.data[pos + 1], img2.data[pos + 2])
        } else {
          this.drawGrayPixel(img1.data, pos, 0.5, output)
        }
      }
    }
    this.findRectangle(matrix, width, height)
    const reacts = this.getReacts(matrix, width, height)
    reacts.forEach(rect => {
      this.drawVLine(output, width, rect.maxX, rect.maxY, rect.minY, 255, 0, 0)
      this.drawVLine(output, width, rect.minX, rect.maxY, rect.minY, 255, 0, 0)

      this.drawHLine(output, width, rect.minY, rect.maxX, rect.minX, 255, 0, 0)
      this.drawHLine(output, width, rect.maxY, rect.maxX, rect.minX, 255, 0, 0)
    })

    fs.writeFileSync('diff.png ', PNG.sync.write(outputPng))
    console.log('pixel count:', pxCount)
    console.log('test', reacts.length)
  }
  rgb2y(r: number, g: number, b: number) {
    return r * 0.29889531 + g * 0.58662247 + b * 0.11448223
  }

  blend(c: number, a: number) {
    return 255 + (c - 255) * a
  }

  drawGrayPixel(img: any, i: number, alpha: number, output: any) {
    const r = img[i + 0]
    const g = img[i + 1]
    const b = img[i + 2]

    const val = this.blend(this.rgb2y(r, g, b), (alpha * img[i + 3]) / 255)
    this.drawPixel(output, i, val, val, val)
  }

  drawPixel(output: any, pos: number, r: number, g: number, b: number) {
    output[pos + 0] = r
    output[pos + 1] = g
    output[pos + 2] = b
    output[pos + 3] = 255
  }

  drawVLine(
    output: any,
    width: number,
    x: number,
    y1: number,
    y2: number,
    r: number,
    g: number,
    b: number
  ) {
    const points = []

    for (let i = Math.min(y1, y2); i <= Math.max(y1, y2); i++) {
      points.push([x, i])
    }
    this.drawPoints(output, points, width, r, g, b)
  }

  drawHLine(
    output: any,
    width: number,
    y: number,
    x1: number,
    x2: number,
    r: number,
    g: number,
    b: number
  ) {
    const points = []

    for (let i = Math.min(x1, x2); i <= Math.max(x1, x2); i++) {
      points.push([i, y])
    }
    this.drawPoints(output, points, width, r, g, b)
  }

  drawPoints(output: any, points: any[][], width: number, r: number, g: number, b: number) {
    points.forEach(([x, y]) => {
      const pos = (y * width + x) * 4
      this.drawPixel(output, pos, r, g, b)
    })
  }

  colorDelta(img1: Buffer, img2: Buffer, k: number, m: number) {
    let r1 = img1[k + 0]
    let g1 = img1[k + 1]
    let b1 = img1[k + 2]
    let a1 = img1[k + 3]

    let r2 = img2[m + 0]
    let g2 = img2[m + 1]
    let b2 = img2[m + 2]
    let a2 = img2[m + 3]

    if (a1 === a2 && r1 === r2 && g1 === g2 && b1 === b2) return 0

    return 1
  }

  findRectangle(points: (number | null)[][], width: number, height: number) {
    let count: number = 1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (points[y][x] === 0) {
          this.joinToRegion(points, x, y, width, height, count)
          count++
        }
      }
    }
  }

  joinToRegion(
    points: (number | null)[][],
    x: number,
    y: number,
    width: number,
    height: number,
    region: number
  ) {
    if (y < 0 || y >= height || x < 0 || x >= width || points[y][x] !== 0) {
      return
    }

    points[y][x] = region

    for (let i = 0; i < this.threshold; i++) {
      this.joinToRegion(points, x + 1 + i, y, width, height, region)
      this.joinToRegion(points, x - 1 + i, y, width, height, region)
      this.joinToRegion(points, x, y + 1 + i, width, height, region)
      this.joinToRegion(points, x, y - 1 + i, width, height, region)

      this.joinToRegion(points, x + 1 + i, y - 1 - i, width, height, region)
      this.joinToRegion(points, x - 1 - i, y + 1 + i, width, height, region)
      this.joinToRegion(points, x + 1 + i, y + 1 + i, width, height, region)
    }
  }

  getReacts(points: (number | null)[][], width: number, height: number) {
    const reacts: any[][] = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = points[y][x]

        if (val !== null) {
          reacts[val - 1] = reacts[val - 1] || []
          reacts[val - 1].push([x, y])
        }
      }
    }

    const reactpoints = reacts.map(react => {
      const xs = react.map(([x]) => x)
      const ys = react.map(([_, x]) => x)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)

      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      return {
        points: [
          [minX, minY],
          [minX, maxY],
          [maxX, minY],
          [maxX, maxY]
        ],
        react,
        count: react.length,
        minX,
        maxX,
        minY,
        maxY
      }
    })

    return reactpoints
  }

  getMatrix(row: number, column: number, value: number | null) {
    const matrix: (number | null)[][] = []
    for (let y = 0; y < row; y++) {
      for (let x = 0; x < column; x++) {
        matrix[y] = matrix[y] || []
        matrix[y][x] = value
      }
    }
    return matrix
  }
}
