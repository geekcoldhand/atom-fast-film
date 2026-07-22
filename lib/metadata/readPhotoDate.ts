/**
 * lib/metadata/readPhotoDate.ts
 *
 * Reads a JPEG's EXIF DateTimeOriginal (falling back to DateTime) directly
 * from the file's bytes — just enough of the JPEG/EXIF/TIFF container
 * format to find one tag, no dependency required.
 *
 * Returns null for non-JPEG files, JPEGs with no EXIF block, or EXIF blocks
 * with neither date tag — this is common for screenshots, re-saved/
 * downloaded images, and anything that's had metadata stripped (many
 * messaging apps do this on send). Callers should treat null as "fall back
 * to asking the user for a date", not as an error.
 */

const JPEG_SOI = 0xffd8
const APP1_MARKER = 0xffe1
const START_OF_SCAN_MARKER = 0xffda
const EXIF_HEADER = "Exif\0\0"
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TAG_DATE_TIME = 0x0132
const TAG_EXIF_IFD_POINTER = 0x8769
const ASCII_TAG_TYPE = 2

export async function readPhotoDate(file: File): Promise<Date | null> {
  const looksLikeJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)
  if (!looksLikeJpeg) return null

  try {
    const buffer = await file.arrayBuffer()
    const view = new DataView(buffer)
    if (view.byteLength < 4 || view.getUint16(0) !== JPEG_SOI) return null

    let offset = 2
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset)
      if ((marker & 0xff00) !== 0xff00) break // not a valid marker — stop rather than misread

      if (marker === START_OF_SCAN_MARKER) break // image data follows — no more metadata segments

      const segmentLength = view.getUint16(offset + 2)
      if (marker === APP1_MARKER) {
        const date = parseExifApp1Segment(view, offset + 4, segmentLength - 2)
        if (date) return date
      }
      offset += 2 + segmentLength
    }
  } catch {
    // Malformed/truncated file — treat like "no EXIF found" rather than throwing.
  }

  return null
}

/** tag -> byte offset of that tag's 12-byte IFD entry (not its value). */
function readIfdEntryOffsets(view: DataView, ifdStart: number, littleEndian: boolean): Map<number, number> {
  const tagToEntryOffset = new Map<number, number>()
  if (ifdStart < 0 || ifdStart + 2 > view.byteLength) return tagToEntryOffset

  const entryCount = view.getUint16(ifdStart, littleEndian)
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) break
    const tag = view.getUint16(entryOffset, littleEndian)
    tagToEntryOffset.set(tag, entryOffset)
  }
  return tagToEntryOffset
}

/** Reads an ASCII-type IFD tag's string value (values >4 bytes are stored
 *  at an offset elsewhere in the TIFF block; shorter values are inline). */
function readAsciiTagValue(
  view: DataView,
  tiffStart: number,
  ifdEntries: Map<number, number>,
  tag: number,
  littleEndian: boolean,
): string | null {
  const entryOffset = ifdEntries.get(tag)
  if (entryOffset === undefined) return null

  const type = view.getUint16(entryOffset + 2, littleEndian)
  const count = view.getUint32(entryOffset + 4, littleEndian)
  if (type !== ASCII_TAG_TYPE) return null

  const valueStart = count <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, littleEndian)
  return readAscii(view, valueStart, count).replace(/\0+$/, "")
}

function parseExifApp1Segment(view: DataView, segmentStart: number, segmentLength: number): Date | null {
  if (segmentLength < EXIF_HEADER.length) return null
  if (readAscii(view, segmentStart, EXIF_HEADER.length) !== EXIF_HEADER) return null

  const tiffStart = segmentStart + EXIF_HEADER.length
  const byteOrderMark = view.getUint16(tiffStart)
  const littleEndian = byteOrderMark === 0x4949 // "II"
  if (!littleEndian && byteOrderMark !== 0x4d4d) return null // neither "II" nor "MM" — not valid TIFF

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian)
  const ifd0Entries = readIfdEntryOffsets(view, tiffStart + ifd0Offset, littleEndian)

  // Prefer DateTimeOriginal (the moment the shutter was pressed), which
  // lives in the Exif sub-IFD pointed to by IFD0's Exif-IFD-pointer tag.
  const exifIfdPointerEntry = ifd0Entries.get(TAG_EXIF_IFD_POINTER)
  if (exifIfdPointerEntry !== undefined) {
    const exifIfdOffset = view.getUint32(exifIfdPointerEntry + 8, littleEndian)
    const exifIfdEntries = readIfdEntryOffsets(view, tiffStart + exifIfdOffset, littleEndian)
    const dateTimeOriginal = readAsciiTagValue(view, tiffStart, exifIfdEntries, TAG_DATE_TIME_ORIGINAL, littleEndian)
    const parsed = dateTimeOriginal && parseExifDateString(dateTimeOriginal)
    if (parsed) return parsed
  }

  // Fall back to IFD0's DateTime tag (file-modified time — still better
  // than defaulting to today for a photo that's actually from last year).
  const dateTime = readAsciiTagValue(view, tiffStart, ifd0Entries, TAG_DATE_TIME, littleEndian)
  return (dateTime && parseExifDateString(dateTime)) || null
}

function readAscii(view: DataView, start: number, length: number): string {
  let text = ""
  for (let i = 0; i < length && start + i < view.byteLength; i++) {
    text += String.fromCharCode(view.getUint8(start + i))
  }
  return text
}

/** EXIF dates are formatted "YYYY:MM:DD HH:MM:SS", in whatever local time
 *  the camera's clock was set to. */
function parseExifDateString(value: string): Date | null {
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second)
  return Number.isNaN(date.getTime()) ? null : date
}
