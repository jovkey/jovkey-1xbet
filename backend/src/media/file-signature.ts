/**
 * Vérification du type réel d'un fichier par ses "magic bytes" (signature binaire),
 * plutôt que de faire confiance au mimetype/extension déclarés par le client (falsifiables
 * en quelques secondes avec n'importe quel éditeur hexadécimal).
 */

type Signature = { kind: 'image' | 'video'; match: (buf: Buffer) => boolean };

const SIGNATURES: Signature[] = [
  // Images
  { kind: 'image', match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }, // JPEG
  {
    kind: 'image',
    match: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  }, // PNG
  { kind: 'image', match: (b) => b.length >= 6 && b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a' }, // GIF
  {
    kind: 'image',
    match: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  }, // WEBP

  // Vidéos
  {
    kind: 'video',
    match: (b) => b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp',
  }, // MP4 / MOV / M4V / 3GP (conteneur ISO-BMFF)
  {
    kind: 'video',
    match: (b) =>
      b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  }, // WEBM / MKV (en-tête EBML)
  {
    kind: 'video',
    match: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'AVI ',
  }, // AVI
];

/** Renvoie le type réel détecté ('image' | 'video') ou null si aucune signature ne correspond. */
export function detectRealKind(buffer: Buffer): 'image' | 'video' | null {
  for (const sig of SIGNATURES) {
    if (sig.match(buffer)) return sig.kind;
  }
  return null;
}
