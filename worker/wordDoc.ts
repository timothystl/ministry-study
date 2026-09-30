// Reads the text out of an old-style Word file (.doc, the "Word 97" binary format). The LCMS posts its
// weekly Prayers of the Church that way. A .doc is a small file system (an OLE compound file) with a
// "WordDocument" stream; where the text sits is listed in the table stream's piece table.
const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const END = 0xfffffffe
const FREE = 0xffffffff
const MAX_BYTES = 5_000_000

export function readWordText(bytes: Uint8Array): string {
  if (bytes.length > MAX_BYTES || SIGNATURE.some((b, i) => bytes[i] !== b))
    throw new Error('This is not a Word document.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (o: number) => view.getUint16(o, true)
  const u32 = (o: number) => view.getUint32(o, true)

  const sectorSize = 1 << u16(0x1e)
  const miniSize = 1 << u16(0x20)
  const cutoff = u32(0x38)
  const sector = (id: number) => {
    const start = (id + 1) * sectorSize
    if (start + sectorSize > bytes.length) throw new Error('This Word document is damaged.')
    return bytes.subarray(start, start + sectorSize)
  }

  // The file allocation table: which sector follows which.
  const fatSectors: number[] = []
  for (let i = 0; i < 109; i++) {
    const id = u32(0x4c + i * 4)
    if (id !== FREE) fatSectors.push(id)
  }
  let difat = u32(0x44)
  for (let n = u32(0x48); n > 0 && difat !== END && difat !== FREE; n--) {
    const s = sector(difat)
    const dv = new DataView(s.buffer, s.byteOffset, s.byteLength)
    for (let i = 0; i < sectorSize / 4 - 1; i++) {
      const id = dv.getUint32(i * 4, true)
      if (id !== FREE) fatSectors.push(id)
    }
    difat = dv.getUint32(sectorSize - 4, true)
  }
  const fat: number[] = []
  for (const id of fatSectors) {
    const s = sector(id)
    const dv = new DataView(s.buffer, s.byteOffset, s.byteLength)
    for (let i = 0; i < sectorSize / 4; i++) fat.push(dv.getUint32(i * 4, true))
  }
  const chain = (first: number, table: number[]) => {
    const ids: number[] = []
    for (let id = first; id !== END && id !== FREE; id = table[id]) {
      if (id === undefined || ids.length > table.length)
        throw new Error('This Word document is damaged.')
      ids.push(id)
    }
    return ids
  }
  const join = (parts: Uint8Array[], size: number) => {
    const out = new Uint8Array(parts.length * (parts[0]?.length ?? 0))
    parts.forEach((p, i) => out.set(p, i * p.length))
    return out.subarray(0, size)
  }
  const bigStream = (first: number, size: number) => join(chain(first, fat).map(sector), size)

  // The directory: the streams in the file, by name.
  const directory = bigStream(u32(0x30), chain(u32(0x30), fat).length * sectorSize)
  const entries = new Map<string, { start: number; size: number; type: number }>()
  for (let o = 0; o + 128 <= directory.length; o += 128) {
    const dv = new DataView(directory.buffer, directory.byteOffset + o, 128)
    const length = dv.getUint16(64, true)
    if (!length) continue
    let name = ''
    for (let i = 0; i < length / 2 - 1; i++) name += String.fromCharCode(dv.getUint16(i * 2, true))
    entries.set(name, {
      start: dv.getUint32(116, true),
      size: dv.getUint32(120, true),
      type: directory[o + 66],
    })
  }
  const root = entries.get('Root Entry')
  const miniFat: number[] = []
  const miniStream =
    root && root.start !== END ? bigStream(root.start, root.size) : new Uint8Array()
  for (const id of chain(u32(0x3c), fat)) {
    const s = sector(id)
    const dv = new DataView(s.buffer, s.byteOffset, s.byteLength)
    for (let i = 0; i < sectorSize / 4; i++) miniFat.push(dv.getUint32(i * 4, true))
  }
  const stream = (name: string) => {
    const e = entries.get(name)
    if (!e) throw new Error('This Word document is missing its text.')
    if (e.size >= cutoff) return bigStream(e.start, e.size)
    return join(
      chain(e.start, miniFat).map((id) => miniStream.subarray(id * miniSize, (id + 1) * miniSize)),
      e.size,
    )
  }

  // The Word part: the header says which table stream holds the piece table.
  const word = stream('WordDocument')
  const wv = new DataView(word.buffer, word.byteOffset, word.byteLength)
  const table = stream(wv.getUint16(0x0a, true) & 0x0200 ? '1Table' : '0Table')
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength)
  const textLength = wv.getUint32(0x4c, true) // characters in the main text
  const clxAt = wv.getUint32(0x1a2, true)
  const clxLength = wv.getUint32(0x1a6, true)
  let pos = clxAt
  const end = clxAt + clxLength
  while (pos < end && table[pos] === 1) pos += 3 + tv.getUint16(pos + 1, true) // formatting, skipped
  if (table[pos] !== 2) throw new Error('This Word document has no text.')
  const plcLength = tv.getUint32(pos + 1, true)
  const plc = pos + 5
  const pieces = (plcLength - 4) / 12
  let text = ''
  for (let i = 0; i < pieces && text.length < textLength; i++) {
    const from = tv.getUint32(plc + i * 4, true)
    const to = tv.getUint32(plc + (i + 1) * 4, true)
    const fc = tv.getUint32(plc + (pieces + 1) * 4 + i * 8 + 2, true)
    const chars = Math.min(to - from, textLength - text.length)
    if (fc & 0x40000000) {
      const at = (fc & 0x3fffffff) / 2
      text += new TextDecoder('windows-1252').decode(word.subarray(at, at + chars))
    } else {
      text += new TextDecoder('utf-16le').decode(word.subarray(fc, fc + chars * 2))
    }
  }
  return text
}

// Word's control characters become plain paragraphs.
export function plainWordText(text: string) {
  let out = ''
  let hiddenCode = false // a field's code (between 0x13 and 0x14) is not shown
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c === 0x13) hiddenCode = true
    else if (c === 0x14 || c === 0x15) hiddenCode = false
    else if (hiddenCode) continue
    else if (c === 0x07 || c === 0x0c || c === 0x0b || c === 0x0d) out += '\n'
    else if (c === 0xa0) out += ' '
    else if (c >= 0x20 || c === 0x09 || c === 0x0a) out += ch
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
