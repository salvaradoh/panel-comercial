export const KAM_NOMBRES: Record<string, string> = {
  'MS': 'Magda Sernaque',
  'JG': 'Joao Guerra',
  'DD': 'Diana Duran',
  'CT': 'Colombina Trujillo',
  'GO': 'Giovanny Olvera',
  'Roberto': 'Roberto Molina',
  'SC': 'Santiago Cuellar',
  'Sharon': 'Sharon Hernandez',
  'CF': 'Camilo Figueroa',
  'BC': 'Benjamin Castro',
  'BG': 'Benjamin González',
  'Aura': 'Aura M. Ávila',
  'LJ': 'Lorenzo Jamasmie',
  'Felipe': 'Felipe Ospina',
  'Ander': 'Anderson León',
  'JC': 'Johanna Calzada',
  'PM': 'Paula Montoya',
  'DA': 'Darling Allendes',
  'LG': 'Laura Galindo',
  'Joao': 'Joao Guerra',       // Perú — nombre completo en BQ
  'Magda': 'Magda Sernaque',   // Perú — nombre completo en BQ
  'Santiago': 'Santiago Cuellar', // Colombia — nombre completo en BQ
  'Paula': 'Paula Montoya',    // Colombia — nombre completo en BQ
  'AA': 'Otros',             // Álvaro Agliati agrupado como Otros
  'EC': 'Otros',             // Otros Chile
};

export function resolverNombreKam(abrev: string): string {
  return KAM_NOMBRES[abrev] ?? abrev;
}

export function inicialesKam(nombre: string): string {
  const partes = nombre.trim().split(' ');
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
