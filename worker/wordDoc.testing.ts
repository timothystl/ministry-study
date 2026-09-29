// Builds a tiny Word 97 file (an OLE compound file with 512-byte sectors) holding the given text, so the
// reader can be tested with invented text. Streams are padded to 4096 bytes so they use the main sectors.
export function makeWordDoc(text: string): Uint8Array {
  const S = 512
  const END = 0xfffffffe
  const FREE = 0xffffffff
  const out = new Uint8Array(S * 19)
  const dv = new DataView(out.buffer)
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  dv.setUint16(0x1e, 9, true)
  dv.setUint16(0x20, 6, true)
  dv.setUint32(0x2c, 1, true)
  dv.setUint32(0x30, 1, true)
  dv.setUint32(0x38, 4096, true)
  dv.setUint32(0x3c, END, true)
  dv.setUint32(0x44, END, true)
  for (let i = 0; i < 109; i++) dv.setUint32(0x4c + i * 4, i === 0 ? 0 : FREE, true)
  const sector = (n: number) => (n + 1) * S
  // FAT (sector 0): itself, the directory (1), WordDocument (2-9), 1Table (10-17)
  const fat = new Array<number>(128).fill(FREE)
  fat[0] = 0xfffffffd
  fat[1] = END
  for (let i = 2; i < 9; i++) fat[i] = i + 1
  fat[9] = END
  for (let i = 10; i < 17; i++) fat[i] = i + 1
  fat[17] = END
  fat.forEach((v, i) => dv.setUint32(sector(0) + i * 4, v, true))
  // Directory (sector 1)
  const entry = (i: number, name: string, type: number, start: number, size: number) => {
    const at = sector(1) + i * 128
    for (let c = 0; c < name.length; c++) dv.setUint16(at + c * 2, name.charCodeAt(c), true)
    dv.setUint16(at + 64, (name.length + 1) * 2, true)
    out[at + 66] = type
    dv.setUint32(at + 116, start, true)
    dv.setUint32(at + 120, size, true)
  }
  entry(0, 'Root Entry', 5, END, 0)
  entry(1, 'WordDocument', 2, 2, 4096)
  entry(2, '1Table', 2, 10, 4096)
  // WordDocument stream (sectors 2-9): header, then the text at 0x800 as 8-bit characters
  const w = sector(2)
  const bytes = [...text].map((c) => (c === '’' ? 0x92 : c.charCodeAt(0)))
  dv.setUint16(w + 0x0a, 0x0200, true)
  dv.setUint32(w + 0x4c, bytes.length, true)
  dv.setUint32(w + 0x1a2, 0, true)
  dv.setUint32(w + 0x1a6, 21, true)
  out.set(bytes, w + 0x800)
  // 1Table stream (sectors 10-17): one piece pointing at the text
  const t = sector(10)
  out[t] = 2
  dv.setUint32(t + 1, 16, true)
  dv.setUint32(t + 5, 0, true)
  dv.setUint32(t + 9, bytes.length, true)
  dv.setUint32(t + 15, (0x800 * 2) | 0x40000000, true)
  return out
}
