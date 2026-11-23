// FILE: src/domain/normalizeKey.ts
// Normalización de nombres para búsqueda (D17). Una única regla aplicada al
// texto escrito y al nombre comparado, para que ambos lados pasen por lo mismo.
//
// Orden de la regla:
//  1. minúsculas
//  2. NFD y eliminación de marcas combinadas
//  3. mapa preventivo (ı → i, porque NFD no la descompone; y ł ø đ ß æ œ)
//  4. eliminar apóstrofes (' ’ ‘ ʼ)
//  5. cualquier otro signo de puntuación pasa a espacio
//  6. colapsar espacios repetidos y recortar extremos
//
// Pruebas de referencia:
//   'Şanlıurfa'      -> 'sanliurfa'
//   'St. John’s'     -> 'st johns'
//   "Côte d'Ivoire"  -> 'cote divoire'
//   'Shebeen El-Kom' -> 'shebeen el kom'

const REPLACEMENTS: Record<string, string> = {
  'ı': 'i',
  'ł': 'l',
  'ø': 'o',
  'đ': 'd',
  'ß': 'ss',
  'æ': 'ae',
  'œ': 'oe',
};

export function normalizeKey(input: string): string {
  let s = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[ıłøđßæœ]/g, (c) => REPLACEMENTS[c] ?? c);
  s = s.replace(/['’‘ʼ]/g, '');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
