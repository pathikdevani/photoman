import Photoman from '../src/photoman'
import * as path from 'path'

/**
 * Dummy test
 */
describe('Dummy test', () => {
  it('works if true is truthy', () => {
    expect(true).toBeTruthy()
  })

  it('DummyClass is instantiable', () => {
    const photoman = new Photoman({
      imageAPath: path.resolve(__dirname, 'test.png'),
      imageBPath: path.resolve(__dirname, 'test.png')
    })

    photoman.compare()
  })
  it.only('DummyClass is instantiable1', () => {
    const photoman = new Photoman({
      imageAPath: path.resolve(__dirname, 'test.png'),
      imageBPath: path.resolve(__dirname, 'test_edited.png')
    })

    photoman.compare()
  })
})
